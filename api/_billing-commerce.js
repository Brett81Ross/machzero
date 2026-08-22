import {
  CREDIT_CATALOG,
  PLAN_CATALOG,
  getRedis,
  getStripe,
  sanitizeInstallId,
  priceIdFor,
  ensureBillingUser,
  metric,
  userKey,
  recoveryMapKey,
  recoveryKeyHash,
  makeRecoveryKey,
  hasDurablePaidAccess,
  numberValue,
  utcMonthWindow,
} from "./_billing-core.js";

export async function addCreditPack(installId, sessionId, credits) {
  const redis = getRedis();
  if (!redis) throw new Error("Usage storage is not configured.");
  await ensureBillingUser(installId);

  const onceKey = `machzero:billing:credit-session:${sessionId}`;
  const wasSet = await redis.set(onceKey, "1", { nx: true, ex: 60 * 60 * 24 * 730 });
  if (!wasSet) return false;

  await redis.hincrby(userKey(installId), "bonus", Number(credits));
  await redis.hset(userKey(installId), { updatedAt: Date.now() });
  return true;
}

function planFromPriceId(priceId) {
  for (const plan of Object.values(PLAN_CATALOG)) {
    if (plan.type === "subscription" && priceIdFor(plan.code) === priceId) return plan.code;
  }
  return null;
}

export async function syncSubscription(subscription, { resetForNewPeriod = false } = {}) {
  const redis = getRedis();
  if (!redis) throw new Error("Usage storage is not configured.");

  const installId = sanitizeInstallId(subscription?.metadata?.installId);
  if (!installId) return false;

  const item = subscription?.items?.data?.[0];
  const priceId = item?.price?.id || "";
  const plan = PLAN_CATALOG[subscription?.metadata?.plan]
    ? subscription.metadata.plan
    : planFromPriceId(priceId);
  if (!plan || plan === "free") return false;

  const current = await ensureBillingUser(installId);
  const periodStartSeconds = numberValue(item?.current_period_start ?? subscription?.current_period_start, 0);
  const periodEndSeconds = numberValue(item?.current_period_end ?? subscription?.current_period_end, 0);
  const periodStart = periodStartSeconds ? periodStartSeconds * 1000 : Date.now();
  const periodEnd = periodEndSeconds ? periodEndSeconds * 1000 : Date.now() + 31 * 24 * 60 * 60 * 1000;
  const changedSubscription = current?.stripeSubscriptionId !== subscription.id || current?.plan !== plan;
  const movedPeriod = periodStart > numberValue(current?.periodStart, 0);
  const shouldReset = changedSubscription || (resetForNewPeriod && movedPeriod);

  const update = {
    plan,
    status: String(subscription.status || "active"),
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "",
    stripeSubscriptionId: subscription.id,
    periodStart,
    periodEnd,
    updatedAt: Date.now(),
  };
  if (shouldReset) update.used = 0;

  await redis.hset(userKey(installId), update);
  return true;
}

export async function downgradeSubscription(subscription) {
  const redis = getRedis();
  if (!redis) throw new Error("Usage storage is not configured.");
  const installId = sanitizeInstallId(subscription?.metadata?.installId);
  if (!installId) return false;
  const window = utcMonthWindow();
  await redis.hset(userKey(installId), {
    plan: "free",
    status: "active",
    used: 0,
    periodStart: window.start,
    periodEnd: window.end,
    stripeSubscriptionId: "",
    updatedAt: Date.now(),
  });
  return true;
}

export async function applyCheckoutSession(session, stripe) {
  const installId = sanitizeInstallId(session?.client_reference_id || session?.metadata?.installId);
  if (!installId) throw new Error("Checkout session is missing its MachZero installation reference.");

  const purchaseType = String(session?.metadata?.purchaseType || "");
  if (purchaseType === "credits") {
    if (session.payment_status !== "paid") return false;
    const code = String(session?.metadata?.code || "");
    const pack = CREDIT_CATALOG[code];
    if (!pack) return false;
    const added = await addCreditPack(installId, session.id, pack.credits);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
    const redis = getRedis();
    if (redis && customerId) await redis.hset(userKey(installId), { stripeCustomerId: customerId, updatedAt: Date.now() });
    if (added) {
      await metric(`purchase_success:${code}`);
      await metric("credit_revenue_cents", Number(session.amount_total || 0));
    }
    return true;
  }

  if (purchaseType === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return false;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const synced = await syncSubscription(subscription);
    if (synced) {
      const redis = getRedis();
      const onceKey = `machzero:billing:subscription-session:${session.id}`;
      const first = redis ? await redis.set(onceKey, "1", { nx: true, ex: 60 * 60 * 24 * 730 }) : null;
      if (first) await metric(`subscription_checkout:${subscription?.metadata?.plan || "unknown"}`);
    }
    return synced;
  }

  return false;
}

export async function customerIdForInstall(installId) {
  const user = await ensureBillingUser(installId);
  return user?.stripeCustomerId || null;
}

export async function createRecoveryKeyForInstall(installId) {
  const redis = getRedis();
  if (!redis) throw new Error("Usage storage is not configured.");
  const user = await ensureBillingUser(installId);
  if (!hasDurablePaidAccess(user)) {
    const error = new Error("A paid plan or scan-pack balance is required before creating a recovery key.");
    error.code = "NO_PAID_ACCESS";
    throw error;
  }

  const priorHash = String(await redis.hget(userKey(installId), "restoreKeyHash") || "");
  if (priorHash) await redis.del(recoveryMapKey(priorHash));

  const recoveryKey = makeRecoveryKey();
  const hashValue = recoveryKeyHash(recoveryKey);
  await redis.hset(userKey(installId), { restoreKeyHash: hashValue, updatedAt: Date.now() });
  await redis.set(recoveryMapKey(hashValue), installId);
  await metric("recovery_key_created");
  return { recoveryKey, user: await ensureBillingUser(installId) };
}

export async function restoreAccessToInstall(destinationInstallId, recoveryKey, stripe = getStripe()) {
  const redis = getRedis();
  if (!redis) throw new Error("Usage storage is not configured.");

  const hashValue = recoveryKeyHash(recoveryKey);
  if (!hashValue) {
    const error = new Error("That recovery key is not valid.");
    error.code = "INVALID_RECOVERY_KEY";
    throw error;
  }

  const sourceInstallId = sanitizeInstallId(await redis.get(recoveryMapKey(hashValue)));
  if (!sourceInstallId) {
    const error = new Error("That recovery key was not found. Check the key and try again.");
    error.code = "RECOVERY_KEY_NOT_FOUND";
    throw error;
  }

  if (sourceInstallId === destinationInstallId) {
    return { moved: false, user: await ensureBillingUser(destinationInstallId) };
  }

  const source = await ensureBillingUser(sourceInstallId);
  const destination = await ensureBillingUser(destinationInstallId);
  if (!source || !hasDurablePaidAccess(source)) {
    const error = new Error("That recovery key no longer has paid MachZero access attached to it.");
    error.code = "NO_PAID_ACCESS";
    throw error;
  }
  if (hasDurablePaidAccess(destination)) {
    const error = new Error("This device already has paid MachZero access. Manage the existing plan instead of overwriting it.");
    error.code = "DESTINATION_HAS_PAID_ACCESS";
    throw error;
  }

  const subscriptionId = source.stripeSubscriptionId;
  if (subscriptionId) {
    if (!stripe) {
      const error = new Error("Stripe is temporarily unavailable, so MachZero cannot safely move this subscription right now.");
      error.code = "STRIPE_UNAVAILABLE";
      throw error;
    }
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { installId: destinationInstallId },
    });
  }

  const now = Date.now();
  const freeWindow = utcMonthWindow(now);
  const transferredUsed = Math.max(Number(source.used || 0), Number(destination.used || 0));
  const script = `
    local source = redis.call('HGETALL', KEYS[1])
    if #source == 0 then return {'missing'}
    for i = 1, #source, 2 do
      local field = source[i]
      local value = source[i + 1]
      if field ~= 'createdAt' then
        redis.call('HSET', KEYS[2], field, value)
      end
    end
    redis.call('HSET', KEYS[2], 'restoreKeyHash', ARGV[1], 'used', ARGV[6], 'updatedAt', ARGV[2])
    redis.call('HSET', KEYS[1],
      'plan', 'free',
      'status', 'active',
      'used', '0',
      'bonus', '0',
      'periodStart', ARGV[3],
      'periodEnd', ARGV[4],
      'stripeCustomerId', '',
      'stripeSubscriptionId', '',
      'restoreKeyHash', '',
      'updatedAt', ARGV[2]
    )
    redis.call('SET', KEYS[3], ARGV[5])
    return {'ok'}
  `;

  try {
    const result = await redis.eval(
      script,
      [userKey(sourceInstallId), userKey(destinationInstallId), recoveryMapKey(hashValue)],
      [hashValue, now, freeWindow.start, freeWindow.end, destinationInstallId, transferredUsed],
    );
    if (!Array.isArray(result) || String(result[0]) !== "ok") throw new Error("Recovery state could not be moved.");
  } catch (error) {
    if (subscriptionId && stripe) {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: { installId: sourceInstallId },
      }).catch(() => null);
    }
    throw error;
  }

  await metric("paid_access_restored");
  return { moved: true, user: await ensureBillingUser(destinationInstallId) };
}

export function appBaseUrl(req) {
  const configured = String(process.env.MACHZERO_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers?.host || "machzero-beta.vercel.app");
  return `${proto}://${host}`;
}
