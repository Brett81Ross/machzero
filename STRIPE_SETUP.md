# MachZero™ Stripe Setup — v1.4.0 Atomic Release

This package contains the Stripe integration code, but this staged copy does not create or modify anything in Stripe, GitHub, or Vercel.

## Products / prices

Create these six prices in the Stripe account that will receive MachZero payments:

| MachZero offer | Billing | Price | Scan allowance |
| --- | --- | ---: | ---: |
| Flip | Monthly subscription | $4.99/month | 40 new-item appraisals/month |
| Reseller | Monthly subscription | $9.99/month | 150 new-item appraisals/month |
| MachZero Pro | Monthly subscription | $19.99/month | 500 new-item appraisals/month |
| 10 Scan Pack | One-time | $2.99 | +10 scans |
| 30 Scan Pack | One-time | $5.99 | +30 scans |
| 100 Scan Pack | One-time | $12.99 | +100 scans |

Free users receive 5 new-item appraisals per calendar month.

## Scan rule

One item appraisal consumes one scan. A specific additional photo requested by MachZero uses the same scan ID and does not consume another scan. A backend failure releases a newly reserved scan. A new chargeable scan starts only for a new item.

## Safe billing switch

`MACHZERO_BILLING_ENFORCED` is the release safety switch.

- Keep it `false` while wiring Stripe/Redis or while running an unmetered local/staged build.
- After all Stripe test-mode cases and Redis entitlement tests pass, set it to `true` for the public paid release.
- If enforcement is `true` but billing configuration/storage is unavailable, MachZero refuses to charge or run the scan and shows a temporary billing error instead of silently giving unlimited paid usage.

## Vercel environment variables

Core billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FLIP_MONTHLY`
- `STRIPE_PRICE_RESELLER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_CREDITS_10`
- `STRIPE_PRICE_CREDITS_30`
- `STRIPE_PRICE_CREDITS_100`
- `MACHZERO_BILLING_ENFORCED`
- `MACHZERO_APP_URL`

Upstash entitlement / recovery storage:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Security / admin:

- `MACHZERO_ADMIN_TOKEN`
- `MACHZERO_SIGNING_SECRET` — random 32+ character secret used to authorize Reverb draft creation from a genuine MachZero appraisal.

Optional Reverb:

- `REVERB_TOKEN` — rotate the previously exposed token before using this variable.

## Stripe webhook

Point the Stripe webhook endpoint at:

`https://YOUR-MACHZERO-DOMAIN/api/stripe-webhook`

Subscribe it to at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## Customer billing management

Paid customers get **Manage Subscription**, backed by Stripe's hosted Customer Portal. Configure the portal in Stripe before enabling billing enforcement.

## Accountless paid-access recovery

MachZero stays zero-input for appraisal and does not force users to create an account. v1.4.0 adds an accountless recovery key for paid access:

- After the first paid subscription or scan-pack purchase, MachZero generates a high-entropy recovery key and shows it to the customer.
- The readable key is not stored. Only its SHA-256 hash is stored in Upstash.
- A customer can enter that key on a replacement/reset device to move the plan, current-period usage, and unused purchased scan credits to the new installation.
- Restoration returns the old installation to Free and updates the Stripe subscription metadata to the new installation, so later webhooks continue to follow the paid user.
- Rotating the key invalidates the previous key.

This is deliberately single-device transfer, not multi-device subscription sharing. A future verified-email/account system can replace it without changing the zero-input appraisal flow.

## Aggregate metrics

The staged code records aggregate counters for installs, scans, scan-limit hits, checkout starts, new subscriptions, scan-pack purchases, renewals, cancellations, payment failures, recovery-key creation, restored access, and gross Stripe revenue counters.

The private `/api/admin-metrics` endpoint requires `X-MachZero-Admin-Token` matching `MACHZERO_ADMIN_TOKEN`.

## Required test before launch

Follow `PRE_DEPLOY_QA.md`. Do not set `MACHZERO_BILLING_ENFORCED=true` until subscription, scan-pack, webhook, failed-payment, recovery-key, and scan-credit tests all pass in Stripe test mode.
