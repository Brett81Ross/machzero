import crypto from "crypto";
import { getRedis } from "./_billing.js";

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sumByPrefix(metrics, prefix) {
  return Object.entries(metrics).reduce((sum, [key, value]) => sum + (key.startsWith(prefix) ? Number(value || 0) : 0), 0);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed." });

  const secret = String(process.env.MACHZERO_ADMIN_TOKEN || "");
  const supplied = String(req.headers?.["x-machzero-admin-token"] || "");
  if (!secret || !safeEqual(secret, supplied)) return res.status(401).json({ success: false, error: "Unauthorized." });

  const redis = getRedis();
  if (!redis) return res.status(503).json({ success: false, error: "Metrics storage is not configured." });

  const month = /^\d{4}-\d{2}$/.test(String(req.query?.month || "")) ? String(req.query.month) : currentMonth();
  const metrics = (await redis.hgetall(`machzero:metrics:${month}`)) || {};
  const installs = Number(metrics.install_created || 0);
  const successfulScans = sumByPrefix(metrics, "scan_success:");
  const failedScans = sumByPrefix(metrics, "scan_failure:");
  const checkoutStarts = sumByPrefix(metrics, "checkout_started:");
  const newSubscriptions = sumByPrefix(metrics, "subscription_checkout:");
  const creditPurchases = sumByPrefix(metrics, "purchase_success:");
  const scanLimitHits = sumByPrefix(metrics, "scan_limit_hit:");
  const paymentFailures = Number(metrics.subscription_payment_failed || 0);
  const recoveryKeysCreated = Number(metrics.recovery_key_created || 0);
  const paidAccessRestored = Number(metrics.paid_access_restored || 0);
  const revenueCents = Number(metrics.subscription_revenue_cents || 0) + Number(metrics.credit_revenue_cents || 0);

  return res.status(200).json({
    success: true,
    month,
    summary: {
      installs,
      successfulScans,
      failedScans,
      checkoutStarts,
      newSubscriptions,
      creditPurchases,
      scanLimitHits,
      paymentFailures,
      recoveryKeysCreated,
      paidAccessRestored,
      freeToSubscriptionConversionPercent: installs ? Math.round((newSubscriptions / installs) * 1000) / 10 : 0,
      grossRevenue: Math.round(revenueCents) / 100,
      averageRevenuePerNewInstall: installs ? Math.round((revenueCents / 100 / installs) * 100) / 100 : 0,
    },
    raw: metrics,
  });
}
