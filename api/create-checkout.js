import {
  PLAN_CATALOG,
  CREDIT_CATALOG,
  appBaseUrl,
  billingConfigured,
  ensureBillingUser,
  getRedis,
  getStripe,
  installIdFromRequest,
  metric,
  priceIdFor,
} from "./_billing.js";

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || String(req.socket?.remoteAddress || "unknown");
}

async function checkoutRateLimit(redis, req, installId) {
  try {
    const hour = Math.floor(Date.now() / 3_600_000);
    const keys = [
      `machzero:checkout:ip:${clientIp(req)}:${hour}`,
      `machzero:checkout:install:${installId}:${hour}`,
    ];
    for (const key of keys) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 3700);
      if (count > 12) return false;
    }
    return true;
  } catch (error) {
    console.warn("MachZero checkout limiter unavailable:", error.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  const stripe = getStripe();
  const redis = getRedis();
  if (!stripe || !redis || !billingConfigured()) return res.status(503).json({ success: false, error: "MachZero billing is not fully configured yet." });

  const installId = installIdFromRequest(req);
  const code = String(req.body?.code || "");
  const product = PLAN_CATALOG[code] || CREDIT_CATALOG[code];
  if (!installId) return res.status(400).json({ success: false, error: "Missing MachZero installation ID." });
  if (!product || product.type === "free") return res.status(400).json({ success: false, error: "That MachZero purchase option is not available." });
  if (!(await checkoutRateLimit(redis, req, installId))) {
    return res.status(429).json({ success: false, error: "Too many checkout requests. Try again later." });
  }

  const priceId = priceIdFor(code);
  if (!priceId) return res.status(503).json({ success: false, error: "That Stripe price has not been connected yet." });

  try {
    const user = await ensureBillingUser(installId);
    const baseUrl = appBaseUrl(req);
    const isSubscription = product.type === "subscription";
    if (isSubscription && user?.plan !== "free" && user?.stripeSubscriptionId) {
      return res.status(409).json({
        success: false,
        code: "ACTIVE_SUBSCRIPTION",
        error: "Use Manage Subscription to change an existing MachZero plan so Stripe does not create a second subscription.",
      });
    }
    const params = {
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: installId,
      metadata: {
        installId,
        purchaseType: isSubscription ? "subscription" : "credits",
        code,
      },
      success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      allow_promotion_codes: true,
    };

    if (isSubscription) {
      params.subscription_data = { metadata: { installId, plan: code } };
      if (user?.stripeCustomerId) params.customer = user.stripeCustomerId;
    } else {
      params.customer_creation = "always";
      if (user?.stripeCustomerId) {
        params.customer = user.stripeCustomerId;
        delete params.customer_creation;
      }
      params.payment_intent_data = { metadata: { installId, purchaseType: "credits", code } };
    }

    const session = await stripe.checkout.sessions.create(params);
    await metric(`checkout_started:${code}`);
    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error("MachZero checkout creation error:", error);
    return res.status(500).json({ success: false, error: "Stripe Checkout could not be started. Try again." });
  }
}
