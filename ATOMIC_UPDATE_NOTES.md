# MachZero™ v1.4.0 Atomic Release Notes

This package is staged locally only. It has not been pushed to GitHub, deployed to Vercel, or connected to live Stripe Price IDs.

## Final hardening stacked on top of v1.3.1

1. **Accountless paid-access recovery.** Paid users can generate a private MachZero recovery key and move a subscription / unused scan-pack balance to a replacement or reset device.
2. Recovery stores only a SHA-256 key hash, rotates old keys, rate-limits guesses, returns the old installation to Free, and moves Stripe subscription metadata so webhooks follow the restored device.
3. New purchases automatically prompt a first-time paid user to save a recovery key after checkout confirmation.
4. Payment-problem states no longer misleadingly show subscription scans as available; subscription allowance pauses while purchased scan-pack credits remain usable.
5. Added an explicit `MACHZERO_BILLING_ENFORCED` launch switch. Setup can stay unmetered with the switch off; once intentionally enabled, an unavailable billing backend fails safely without charging the scan.
6. Reverb draft creation now requires a short-lived signed appraisal authorization. A caller cannot directly hit the endpoint and freely choose a title, price, or condition.
7. Reverb draft requests are idempotent per scan and return the existing draft instead of creating duplicates on retry.
8. Checkout, billing-portal, recovery, Reverb, and scan paths have rate/abuse controls.
9. The unused legacy history endpoint was closed instead of leaving an arbitrary user-ID history read available.
10. API responses are marked no-store and Vercel response hardening now includes `X-Frame-Options: DENY`.
11. Image payload budget was tightened for serverless reliability while preserving an 1800px detail ceiling for labels/SKUs/condition evidence.
12. Added `npm run predeploy-check` and a dedicated `PRE_DEPLOY_QA.md` release gate.
13. Version and service-worker cache bumped to **v1.4.0**.

## Zero-input product behavior retained

- Snap an item and analysis starts automatically.
- No category, brand, model, condition, or appraisal form is required.
- MachZero automatically infers defensible item details from photos.
- If a detail would materially tighten the appraisal, MachZero asks for one specific next photo.
- Requested follow-up photos refine the same scan and do not consume another scan.
- Results include List It, Expected Sale, Sell Fast, Max Buy, target profit, best marketplace, confidence, comparable evidence, and ready-to-list copy.
- A specific buy cost is optional and hidden behind the result.

## Sharing retained

- Top Share button: native share sheet, copy fallback, branded QR.
- Result Share Appraisal button: item and pricing summary through the native share sheet / copy fallback.
- Sharing consumes no scan.

## Monetization retained

- Free: 5 scans/month.
- Flip: $4.99/month — 40 scans.
- Reseller: $9.99/month — 150 scans.
- MachZero Pro: $19.99/month — 500 scans.
- Scan packs: 10/$2.99, 30/$5.99, 100/$12.99.
- One new item = one scan.
- Failed first appraisals release their reserved scan.
- Stripe Checkout, webhook lifecycle handling, Customer Portal, Upstash usage accounting, and private aggregate metrics remain included.

## Release gate

Do not deploy the monetized public release until every case in `PRE_DEPLOY_QA.md` passes in Stripe test mode. In particular, verify subscription renewal, payment failure, cancellation, all scan packs, failed-scan credit release, same-item photo refinements, recovery-key migration, and Android/iPhone PWA behavior.

Before live deployment, rotate the previously exposed Reverb credential and use only the new `REVERB_TOKEN` value in the deployment environment.
