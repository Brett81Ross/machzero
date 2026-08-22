export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed." });
  return res.status(410).json({
    success: false,
    code: "HISTORY_NOT_ENABLED",
    error: "MachZero history is not enabled in this release.",
  });
}
