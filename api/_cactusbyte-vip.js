import crypto from "crypto";

const COOKIE_NAME = "mz_cactusbyte_vip";
const APP_ID = "machzero";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

function secret() {
  return process.env.MACHZERO_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY || process.env.GEMINI_API_KEY || null;
}

function parseCookies(req) {
  return String(req.headers?.cookie || "").split(";").reduce((out, part) => {
    const index = part.indexOf("=");
    if (index < 0) return out;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
    return out;
  }, {});
}

function signedValue(payload, key) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function cactusByteVipFromRequest(req) {
  const key = secret();
  if (!key) return false;
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return false;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return false;
  const expected = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload?.kind === "cactusbyte-vip" && payload?.appId === APP_ID && payload?.status === "lifetime";
  } catch {
    return false;
  }
}

export function cactusByteVipCookie() {
  const key = secret();
  if (!key) return null;
  const value = signedValue({ kind: "cactusbyte-vip", appId: APP_ID, status: "lifetime", issuedAt: Date.now() }, key);
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function cactusByteVipUser(installId) {
  return {
    installId,
    plan: "cactusbyte-vip",
    planName: "CactusByte VIP · Lifetime",
    status: "active",
    allowance: 999999999,
    used: 0,
    bonusCredits: 0,
    includedRemaining: 999999999,
    remaining: 999999999,
    periodStart: null,
    periodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    hasRecoveryKey: false,
    cactusByteVip: true,
  };
}
