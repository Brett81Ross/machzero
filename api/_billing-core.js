import crypto from "crypto";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

export const PLAN_CATALOG = {
  free: { code: "free", name: "Free", price: 0, interval: "month", scans: 5, type: "free" },
  flip: { code: "flip", name: "Flip", price: 4.99, interval: "month", scans: 40, type: "subscription", priceEnv: "STRIPE_PRICE_FLIP_MONTHLY" },
  reseller: { code: "reseller", name: "Reseller", price: 9.99, interval: "month", scans: 150, type: "subscription", priceEnv: "STRIPE_PRICE_RESELLER_MONTHLY", recommended: true },
  pro: { code: "pro", name: "MachZero Pro", price: 19.99, interval: "month", scans: 500, type: "subscription", priceEnv: "STRIPE_PRICE_PRO_MONTHLY" },
};

export const CREDIT_CATALOG = {
  credits10: { code: "credits10", name: "10 Scan Pack", price: 2.99, credits: 10, type: "credits", priceEnv: "STRIPE_PRICE_CREDITS_10" },
  credits30: { code: "credits30", name: "30 Scan Pack", price: 5.99, credits: 30, type: "credits", priceEnv: "STRIPE_PRICE_CREDITS_30" },
  credits100: { code: "credits100", name: "100 Scan Pack", price: 12.99, credits: 100, type: "credits", priceEnv: "STRIPE_PRICE_CREDITS_100" },
};

let stripeSingleton = null;
let redisSingleton = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeSingleton) stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeSingleton;
}

export function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redisSingleton) {
    redisSingleton = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisSingleton;
}

export function billingEnforcementRequested() {
  return /^(1|true|yes|on)$/i.test(String(process.env.MACHZERO_BILLING_ENFORCED || ""));
}

export function billingConfigured() {
  const allPricesReady = [
    "flip",
    "reseller",
    "pro",
    "credits10",
    "credits30",
    "credits100",
  ].every((code) => Boolean(priceIdFor(code)));
  return Boolean(
    getStripe() &&
    getRedis() &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    allPricesReady
  );
}

export function billingReadyForEnforcement() {
  return !billingEnforcementRequested() || billingConfigured();
}

export function sanitizeInstallId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(id)) return null;
  return id;
}

export function installIdFromRequest(req) {
  return sanitizeInstallId(req.headers?.["x-machzero-install-id"] || req.body?.installId || req.query?.installId);
}

export function scanIdFromRequest(req) {
  const id = String(req.headers?.["x-machzero-scan-id"] || req.body?.scanId || "").trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id) ? id : null;
}

export function priceIdFor(code) {
  const item = PLAN_CATALOG[code] || CREDIT_CATALOG[code];
  return item?.priceEnv ? String(process.env[item.priceEnv] || "").trim() : "";
}

export function publicCatalog() {
  return {
    plans: Object.values(PLAN_CATALOG).map((item) => ({
      code: item.code,
      name: item.name,
      price: item.price,
      interval: item.interval,
      scans: item.scans,
      type: item.type,
      recommended: Boolean(item.recommended),
      available: item.type === "free" || Boolean(priceIdFor(item.code)),
    })),
    credits: Object.values(CREDIT_CATALOG).map((item) => ({
      code: item.code,
      name: item.name,
      price: item.price,
      credits: item.credits,
      type: item.type,
      available: Boolean(priceIdFor(item.code)),
    })),
  };
}

export function userKey(installId) {
  return `machzero:billing:user:${installId}`;
}

function scanKey(installId, scanId) {
  return `machzero:billing:scan:${installId}:${scanId}`;
}

export function recoveryMapKey(hashValue) {
  return `machzero:billing:recovery:${hashValue}`;
}

function normalizeRecoveryKey(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^MZ[A-HJ-NP-Z2-9]{20}$/.test(clean)) return null;
  return clean;
}

export function recoveryKeyHash(value) {
  const normalized = normalizeRecoveryKey(value);
  return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : null;
}

function formatRecoveryKey(raw) {
  return `MZ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}`;
}

export function makeRecoveryKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 20; i += 1) raw += alphabet[bytes[i] % alphabet.length];
  return formatRecoveryKey(raw);
}

export function hasDurablePaidAccess(user) {
  if (!user) return false;
  return Boolean(
    (user.plan && user.plan !== "free" && ["active", "trialing", "past_due"].includes(user.status)) ||
    Number(user.bonusCredits || 0) > 0
  );
}

export function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function utcMonthWindow(now = Date.now()) {
  const date = new Date(now);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return { start, end };
}

async function hash(redis, key) {
  const result = await redis.hgetall(key);
  return result && typeof result === "object" ? result : {};
}

export async function metric(name, amount = 1) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const d = new Date();
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `machzero:metrics:${month}`;
    await redis.hincrby(key, String(name).slice(0, 96), Math.round(amount));
    await redis.expire(key, 60 * 60 * 24 * 400);
  } catch (_) {}
}

export async function ensureBillingUser(installId) {
  const redis = getRedis();
  if (!redis) return null;

  const key = userKey(installId);
  let current = await hash(redis, key);
  const now = Date.now();

  if (!current.plan) {
    const window = utcMonthWindow(now);
    await redis.hset(key, {
      plan: "free",
      status: "active",
      used: 0,
      bonus: 0,
      periodStart: window.start,
      periodEnd: window.end,
      createdAt: now,
      updatedAt: now,
    });
    await metric("install_created");
    current = await hash(redis, key);
  }

  const plan = PLAN_CATALOG[current.plan] ? current.plan : "free";
  const periodEnd = numberValue(current.periodEnd, 0);
  if (plan === "free" && periodEnd <= now) {
    const window = utcMonthWindow(now);
    await redis.hset(key, {
      plan: "free",
      status: "active",
      used: 0,
      periodStart: window.start,
      periodEnd: window.end,
      updatedAt: now,
    });
    current = await hash(redis, key);
  }

  return normalizeUser(current, installId);
}

function normalizeUser(current, installId) {
  const plan = PLAN_CATALOG[current.plan] ? current.plan : "free";
  const status = String(current.status || "active");
  const allowance = PLAN_CATALOG[plan]?.scans || PLAN_CATALOG.free.scans;
  const used = Math.max(0, numberValue(current.used, 0));
  const bonus = Math.max(0, numberValue(current.bonus, 0));
  const subscriptionUsable = plan === "free" || ["active", "trialing"].includes(status);
  const includedRemaining = subscriptionUsable ? Math.max(0, allowance - used) : 0;
  return {
    installId,
    plan,
    planName: PLAN_CATALOG[plan]?.name || "Free",
    status,
    allowance,
    used,
    bonusCredits: bonus,
    includedRemaining,
    remaining: includedRemaining + bonus,
    periodStart: numberValue(current.periodStart, 0) || null,
    periodEnd: numberValue(current.periodEnd, 0) || null,
    stripeCustomerId: current.stripeCustomerId || null,
    stripeSubscriptionId: current.stripeSubscriptionId || null,
    hasRecoveryKey: Boolean(current.restoreKeyHash),
  };
}

export async function usageSnapshot(installId) {
  const user = await ensureBillingUser(installId);
  return {
    configured: billingConfigured(),
    enforcementRequested: billingEnforcementRequested(),
    readyForEnforcement: billingReadyForEnforcement(),
    user: user || {
      installId,
      plan: "free",
      planName: "Free",
      status: "local",
      allowance: 5,
      used: 0,
      bonusCredits: 0,
      includedRemaining: 5,
      remaining: 5,
      periodStart: null,
      periodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      hasRecoveryKey: false,
    },
    catalog: publicCatalog(),
  };
}

export async function reserveScanCredit(installId, scanId) {
  const redis = getRedis();
  if (!billingEnforcementRequested()) {
    return { allowed: true, newReservation: false, source: "unmetered", snapshot: await usageSnapshot(installId) };
  }
  if (!redis || !billingConfigured()) {
    return {
      allowed: false,
      newReservation: false,
      source: "billing_unavailable",
      code: "BILLING_UNAVAILABLE",
      snapshot: await usageSnapshot(installId),
    };
  }

  const user = await ensureBillingUser(installId);
  const planInfo = PLAN_CATALOG[user.plan] || PLAN_CATALOG.free;
  const includedAllowance = ["active", "trialing"].includes(user.status) ? planInfo.scans : 0;
  const ttlSeconds = 60 * 60 * 24 * 45;

  const script = `
    local existing = redis.call('GET', KEYS[2])
    if existing then
      return {'repeat', existing}
    end
    local used = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
    local bonus = tonumber(redis.call('HGET', KEYS[1], 'bonus') or '0')
    local allowance = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])
    if used < allowance then
      redis.call('HINCRBY', KEYS[1], 'used', 1)
      redis.call('HSET', KEYS[1], 'updatedAt', ARGV[3])
      redis.call('SET', KEYS[2], 'included', 'EX', ttl)
      return {'included', tostring(used + 1), tostring(bonus)}
    end
    if bonus > 0 then
      redis.call('HINCRBY', KEYS[1], 'bonus', -1)
      redis.call('HSET', KEYS[1], 'updatedAt', ARGV[3])
      redis.call('SET', KEYS[2], 'bonus', 'EX', ttl)
      return {'bonus', tostring(used), tostring(bonus - 1)}
    end
    return {'limit', tostring(used), tostring(bonus)}
  `;

  const result = await redis.eval(script, [userKey(installId), scanKey(installId, scanId)], [includedAllowance, ttlSeconds, Date.now()]);
  const source = Array.isArray(result) ? String(result[0]) : "limit";

  if (source === "limit") {
    await metric(`scan_limit_hit:${user.plan}`);
    return { allowed: false, newReservation: false, source, snapshot: await usageSnapshot(installId) };
  }

  const newReservation = source === "included" || source === "bonus";
  if (newReservation) await metric(`scan_started:${user.plan}`);
  return { allowed: true, newReservation, source, snapshot: await usageSnapshot(installId) };
}

export async function releaseScanCredit(installId, scanId, source) {
  const redis = getRedis();
  if (!redis || !["included", "bonus"].includes(source)) return;

  const key = userKey(installId);
  const sKey = scanKey(installId, scanId);
  const existing = await redis.get(sKey);
  if (existing !== source) return;

  if (source === "included") {
    const used = numberValue(await redis.hget(key, "used"), 0);
    if (used > 0) await redis.hincrby(key, "used", -1);
  } else {
    await redis.hincrby(key, "bonus", 1);
  }
  await redis.del(sKey);
  await redis.hset(key, { updatedAt: Date.now() });
}

export async function markScanSuccess(plan = "unknown") {
  await metric(`scan_success:${plan}`);
}

export async function markScanFailure(plan = "unknown") {
  await metric(`scan_failure:${plan}`);
}
