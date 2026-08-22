# MachZero™

MachZero™ is a mobile-first, zero-input AI resale evaluator from Cactus🌵Byte Studios™. The staged v1.4.0 Atomic Release keeps the user experience simple — snap photos and get the resale decision — while moving pricing logic, usage accounting, payment safety, and recovery behind the scenes.

## v1.4.0 — Atomic Release

### Zero-input appraisal

- No appraisal form, category picker, condition picker, brand field, or required Analyze button.
- The first photo automatically starts analysis after local image preparation.
- MachZero infers defensible category, brand, model, variant, visible identifier/SKU, size, color, included accessories, and condition from visual evidence.
- If another photo would materially improve identification or pricing confidence, MachZero asks for one specific next photo and refines the same scan for no additional scan credit.
- Image preparation retains useful label/detail resolution while keeping the total request below a safer serverless payload budget.
- Results show List It, Expect, Sell Fast, Max Buy, target profit, best marketplace, confidence, condition evidence, comparables, sources, and ready-to-list copy.
- Optional buy-cost entry provides a precise BUY/PASS and estimated net-profit check without becoming part of the appraisal flow.

### Sharing / install

- Native Android/iOS share flow with copy fallback.
- Branded MachZero QR for sharing the app.
- One-tap Share Appraisal for the current evaluation.
- PWA manifest, install handling, service worker, versioned cache, Apple home-screen metadata, and mobile safe-area layout.

### Monetization

- Free: 5 new-item appraisals/month.
- Flip: $4.99/month for 40 scans.
- Reseller: $9.99/month for 150 scans.
- MachZero Pro: $19.99/month for 500 scans.
- One-time packs: 10 scans/$2.99, 30/$5.99, 100/$12.99.
- Every tier gets the same appraisal quality; paid plans buy usage rather than better answers.
- One new item equals one scan. Requested refinement photos for the same item do not consume another scan.
- Failed AI appraisals release a newly reserved scan credit.
- Stripe hosted Checkout and Customer Portal.
- Upstash-backed entitlements and aggregate metrics.
- Explicit `MACHZERO_BILLING_ENFORCED` release switch prevents accidental enforcement before Stripe/Redis are tested; when enforcement is intentionally on, billing failure blocks the scan without charging it instead of silently allowing unlimited usage.

### Paid-access recovery

- Accountless recovery keys for subscriptions and unused scan-pack credits.
- Recovery keys are generated with high entropy; only a SHA-256 hash is stored.
- Restoring moves the paid entitlement to the new installation and returns the previous installation to Free.
- Active Stripe subscription metadata is moved to the restored installation so later webhook events continue updating the correct device.
- Recovery attempts and key generation are rate-limited.

### Security / hardening

- Reverb token remains server-side in `REVERB_TOKEN`.
- Reverb Draft now requires a short-lived HMAC-signed authorization produced by a genuine MachZero appraisal; the client cannot change the signed title, price, or condition used for the draft.
- Successful Reverb drafts are idempotent per scan to prevent accidental duplicates.
- Checkout, portal, recovery, scan, and Reverb operations have abuse limits.
- The unused legacy history endpoint no longer exposes arbitrary cross-origin history reads.
- API responses are marked no-store and the app sends clickjacking/content-type/referrer/permissions hardening headers through Vercel.
- `npm run predeploy-check` validates release version consistency, required routes, hardening flags, branding, sharing, recovery, and obvious hard-coded secrets.

## Required deployment environment variables

Core:

- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Stripe monetization:

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

Security / admin:

- `MACHZERO_ADMIN_TOKEN`
- `MACHZERO_SIGNING_SECRET`

Optional:

- `REVERB_TOKEN`

See `STRIPE_SETUP.md` and `PRE_DEPLOY_QA.md` before the eventual single deployment.

## Pricing philosophy

MachZero prioritizes exact visual identification, visible condition evidence, close/sold comparable evidence, and confidence limits. It should not manufacture an exact model or artificially tight price when the supplied evidence does not support one.

## Branding

MachZero™ · Cactus🌵Byte Studios™ · All Rights Reserved
