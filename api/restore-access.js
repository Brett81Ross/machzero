import {
  getRedis,
  getStripe,
  installIdFromRequest,
  restoreAccessToInstall,
  usageSnapshot,
} from "./_billing.js";

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || String(req.socket?.remoteAddress || "unknown");
}

async function rateLimit(req, installId) {
  const redis = getRedis();
  if (!redis) return true;
  const hour = Math.floor(Date.now() / 3_600_000);
  const keys = [
    `machzero:restore:ip:${clientIp(req)}:${hour}`,
    `machzero:restore:install:${installId}:${hour}`,
  ];
  for (const key of keys) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3700);
    if (count > 10) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  const installId = installIdFromRequest(req);
  const recoveryKey = String(req.body?.recoveryKey || "").trim();
  if (!installId || !recoveryKey) return res.status(400).json({ success: false, error: "Enter your MachZero recovery key." });
  if (!getRedis()) return res.status(503).json({ success: false, error: "MachZero recovery is temporarily unavailable." });

  try {
    if (!(await rateLimit(req, installId))) {
      return res.status(429).json({ success: false, error: "Too many recovery attempts. Try again later." });
    }
    const result = await restoreAccessToInstall(installId, recoveryKey, getStripe());
    const snapshot = await usageSnapshot(installId);
    return res.status(200).json({
      success: true,
      moved: result.moved,
      ...snapshot,
      message: result.moved
        ? "Paid MachZero access was moved to this device. The previous installation has been returned to the Free plan."
        : "This recovery key is already connected to this device.",
    });
  } catch (error) {
    const known = new Set([
      "INVALID_RECOVERY_KEY",
      "RECOVERY_KEY_NOT_FOUND",
      "NO_PAID_ACCESS",
      "DESTINATION_HAS_PAID_ACCESS",
      "STRIPE_UNAVAILABLE",
    ]);
    const status = ["INVALID_RECOVERY_KEY", "RECOVERY_KEY_NOT_FOUND"].includes(error?.code)
      ? 404
      : error?.code === "DESTINATION_HAS_PAID_ACCESS"
        ? 409
        : error?.code === "STRIPE_UNAVAILABLE"
          ? 503
          : 500;
    return res.status(status).json({
      success: false,
      code: known.has(error?.code) ? error.code : "RESTORE_ERROR",
      error: error?.message || "MachZero could not restore paid access.",
    });
  }
}
