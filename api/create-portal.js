import { appBaseUrl, customerIdForInstall, getRedis, getStripe, installIdFromRequest } from "./_billing.js";

async function portalRateLimit(installId) {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const hour = Math.floor(Date.now() / 3_600_000);
    const key = `machzero:portal:${installId}:${hour}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3700);
    return count <= 12;
  } catch (error) {
    console.warn("MachZero portal limiter unavailable:", error.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ success: false, error: "Stripe is not configured yet." });
  const installId = installIdFromRequest(req);
  if (!installId) return res.status(400).json({ success: false, error: "Missing MachZero installation ID." });
  if (!(await portalRateLimit(installId))) return res.status(429).json({ success: false, error: "Too many billing-portal requests. Try again later." });

  try {
    const customer = await customerIdForInstall(installId);
    if (!customer) return res.status(404).json({ success: false, error: "No Stripe subscription is connected to this MachZero installation yet." });
    const session = await stripe.billingPortal.sessions.create({ customer, return_url: appBaseUrl(req) });
    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error("MachZero billing portal error:", error);
    return res.status(500).json({ success: false, error: "The Stripe billing portal could not be opened." });
  }
}
