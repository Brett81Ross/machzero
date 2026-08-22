import { installIdFromRequest, publicCatalog, usageSnapshot } from "./_billing.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed." });
  const installId = installIdFromRequest(req);
  if (!installId) return res.status(400).json({ success: false, error: "Missing MachZero installation ID." });

  try {
    const snapshot = await usageSnapshot(installId);
    return res.status(200).json({ success: true, ...snapshot, catalog: snapshot.catalog || publicCatalog() });
  } catch (error) {
    console.error("MachZero billing status error:", error);
    return res.status(500).json({ success: false, error: "MachZero could not load plan status." });
  }
}
