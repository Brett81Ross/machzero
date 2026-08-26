import { cactusByteVipCookie } from "./_cactusbyte-vip.js";

const VERIFY_URL = "https://cactusbyte-studios.vercel.app/api/tester/consume-app-token";
const APP_ID = "machzero";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  const token = String(req.query?.token || "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return res.status(400).send("Invalid VIP activation token.");
  const cookie = cactusByteVipCookie();
  if (!cookie) return res.status(503).send("VIP activation is not configured.");

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, appId: APP_ID }),
      cache: "no-store",
    });
    if (!response.ok) return res.status(403).send("VIP activation expired or already used.");
    const payload = await response.json().catch(() => ({}));
    if (payload?.ok !== true || payload?.status !== "lifetime" || payload?.appId !== APP_ID) {
      return res.status(403).send("VIP activation could not be verified.");
    }
    res.setHeader("Set-Cookie", cookie);
    const returnUrl = String(process.env.MACHZERO_APP_URL || "https://machzero-beta.vercel.app").replace(/\/$/, "");
    return res.redirect(302, `${returnUrl}/`);
  } catch (error) {
    console.error("CactusByte VIP activation failed", error);
    return res.status(503).send("VIP activation is temporarily unavailable.");
  }
}
