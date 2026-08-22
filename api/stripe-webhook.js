import {
  applyCheckoutSession,
  downgradeSubscription,
  getRedis,
  getStripe,
  metric,
  syncSubscription,
} from "./_billing.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function subscriptionIdFromInvoice(invoice) {
  const value = invoice?.subscription || invoice?.parent?.subscription_details?.subscription;
  return typeof value === "string" ? value : value?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const stripe = getStripe();
  const redis = getRedis();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "");
  if (!stripe || !redis || !webhookSecret) return res.status(503).send("Stripe webhook is not configured");

  let event;
  try {
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, req.headers["stripe-signature"], webhookSecret);
  } catch (error) {
    console.error("MachZero Stripe signature error:", error.message);
    return res.status(400).send("Invalid Stripe signature");
  }

  const eventKey = `machzero:stripe:event:${event.id}`;
  if (await redis.get(eventKey)) return res.status(200).json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await applyCheckoutSession(event.data.object, stripe);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await downgradeSubscription(event.data.object);
        await metric("subscription_cancelled");
        break;
      case "invoice.paid": {
        const subscriptionId = subscriptionIdFromInvoice(event.data.object);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription, { resetForNewPeriod: true });
          await metric("subscription_renewed");
          await metric("subscription_revenue_cents", Number(event.data.object?.amount_paid || 0));
        }
        break;
      }
      case "invoice.payment_failed": {
        const subscriptionId = subscriptionIdFromInvoice(event.data.object);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
          await metric("subscription_payment_failed");
        }
        break;
      }
      default:
        break;
    }

    await redis.set(eventKey, "1", { ex: 60 * 60 * 24 * 730 });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("MachZero Stripe webhook processing error:", error);
    return res.status(500).send("Webhook processing failed");
  }
}
