import { applyCheckoutSession, getStripe, installIdFromRequest, usageSnapshot } from "./_billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ success: false, error: "Stripe is not configured yet." });

  const installId = installIdFromRequest(req);
  const sessionId = String(req.body?.sessionId || "").trim();
  if (!installId || !sessionId.startsWith("cs_")) return res.status(400).json({ success: false, error: "Invalid checkout confirmation." });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== installId) return res.status(403).json({ success: false, error: "This checkout belongs to another MachZero installation." });
    if (session.status !== "complete") return res.status(409).json({ success: false, error: "Stripe Checkout is not complete yet." });

    await applyCheckoutSession(session, stripe);
    const snapshot = await usageSnapshot(installId);
    return res.status(200).json({ success: true, ...snapshot });
  } catch (error) {
    console.error("MachZero checkout confirmation error:", error);
    return res.status(500).json({ success: false, error: "MachZero could not confirm that Stripe checkout." });
  }
}
