import { cactusByteVipCookie } from "./_cactusbyte-vip.js";

const VERIFY_URL = "https://cactusbyte-studios.vercel.app/api/tester/consume-app-token";
const APP_ID = "machzero";
const VERIFY_TIMEOUT_MS = 4000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  const token = String(req.query?.token || "").trim();
  const returnUrl = String(process.env.MACHZERO_APP_URL || "https://machzero-beta.vercel.app").replace(/\/$/, "");
  const fallback = () => res.redirect(302, `${returnUrl}/`);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return fallback();
  const cookie = cactusByteVipCookie();
  if (!cookie) return fallback();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, appId: APP_ID }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return fallback();
    const payload = await response.json().catch(() => ({}));
    if (payload?.ok !== true || payload?.status !== "lifetime" || payload?.appId !== APP_ID) return fallback();
    res.setHeader("Set-Cookie", cookie);
    return res.redirect(302, `${returnUrl}/`);
  } catch (error) {
    console.error("CactusByte VIP activation failed", error);
    return fallback();
  } finally {
    clearTimeout(timeout);
  }
}
