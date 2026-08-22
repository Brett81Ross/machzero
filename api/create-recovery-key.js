import {
  createRecoveryKeyForInstall,
  getRedis,
  installIdFromRequest,
  usageSnapshot,
} from "./_billing.js";

async function rateLimit(installId) {
  const redis = getRedis();
  if (!redis) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `machzero:recovery-key:${installId}:${day}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60 * 60 * 25);
  return count <= 5;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  const installId = installIdFromRequest(req);
  if (!installId) return res.status(400).json({ success: false, error: "Missing MachZero installation ID." });
  if (!getRedis()) return res.status(503).json({ success: false, error: "MachZero recovery storage is not configured yet." });

  try {
    if (!(await rateLimit(installId))) {
      return res.status(429).json({ success: false, error: "Too many recovery-key requests today. Try again tomorrow." });
    }
    const result = await createRecoveryKeyForInstall(installId);
    const snapshot = await usageSnapshot(installId);
    return res.status(200).json({
      success: true,
      recoveryKey: result.recoveryKey,
      user: snapshot.user,
      message: "Save this recovery key somewhere private. MachZero cannot display the same key again later; generating another key replaces it.",
    });
  } catch (error) {
    const status = error?.code === "NO_PAID_ACCESS" ? 409 : 500;
    return res.status(status).json({ success: false, code: error?.code || "RECOVERY_KEY_ERROR", error: error?.message || "MachZero could not create a recovery key." });
  }
}
