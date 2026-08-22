import crypto from "crypto";

function secret() {
  return String(process.env.MACHZERO_SIGNING_SECRET || "").trim();
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload) {
  const key = secret();
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function appraisalSigningConfigured() {
  return Boolean(secret());
}

export function createAppraisalToken({ installId, scanId, itemTitle, price, conditionGrade, ttlSeconds = 1800 }) {
  if (!secret()) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = {
    v: 1,
    i: String(installId || ""),
    s: String(scanId || ""),
    t: String(itemTitle || "").slice(0, 160),
    p: Math.round(Number(price || 0) * 100) / 100,
    c: String(conditionGrade || "Unknown").slice(0, 32),
    iat: now,
    exp: now + Math.max(60, Math.min(3600, Number(ttlSeconds) || 1800)),
  };
  const payload = encode(JSON.stringify(body));
  const sig = signature(payload);
  return sig ? `${payload}.${sig}` : null;
}

export function verifyAppraisalToken(token) {
  const key = secret();
  if (!key) return { valid: false, code: "SIGNING_NOT_CONFIGURED" };
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { valid: false, code: "INVALID_TOKEN" };
  const [payload, suppliedSignature] = parts;
  const expectedSignature = signature(payload);
  if (!expectedSignature || !safeEqual(suppliedSignature, expectedSignature)) {
    return { valid: false, code: "INVALID_TOKEN" };
  }

  try {
    const body = JSON.parse(decode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (body?.v !== 1 || !body?.i || !body?.s || !body?.t || !body?.p || !body?.c) {
      return { valid: false, code: "INVALID_TOKEN" };
    }
    if (Number(body.exp || 0) < now) return { valid: false, code: "TOKEN_EXPIRED" };
    if (Number(body.iat || 0) > now + 60) return { valid: false, code: "INVALID_TOKEN" };
    return {
      valid: true,
      installId: String(body.i),
      scanId: String(body.s),
      itemTitle: String(body.t),
      price: Number(body.p),
      conditionGrade: String(body.c),
      expiresAt: Number(body.exp) * 1000,
    };
  } catch (_) {
    return { valid: false, code: "INVALID_TOKEN" };
  }
}
