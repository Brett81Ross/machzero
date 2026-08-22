# MachZero™ v1.4.0 Pre-Deployment QA

This is the final release-gate checklist for the staged atomic build. Do not enable paid enforcement until the Stripe and recovery tests pass in Stripe test mode.

## Release gate

- Run `npm run predeploy-check` and require a clean pass.
- Confirm `GEMINI_API_KEY`, Upstash, all six Stripe Price IDs, Stripe webhook secret, `MACHZERO_ADMIN_TOKEN`, and a random 32+ character `MACHZERO_SIGNING_SECRET` are present.
- Keep `MACHZERO_BILLING_ENFORCED=false` during setup and test-mode configuration. Change it to `true` only when Redis, Stripe Checkout, webhooks, and scan entitlements are confirmed working.
- Rotate the old Reverb token before adding a new `REVERB_TOKEN`.

## Scan-credit tests

- Free install begins with 5 monthly scans.
- First successful appraisal consumes exactly 1 scan.
- Requested follow-up photo uses the same scan ID and consumes 0 additional scans.
- Retry after an upstream AI failure does not permanently consume a scan.
- **SCAN ANOTHER ITEM** creates a new scan ID and consumes the next scan only when analysis starts.
- Sixth Free appraisal opens the plan/scan-pack screen instead of calling Gemini.
- If paid billing enforcement is intentionally enabled but billing storage/configuration is unavailable, the scan is blocked with a clear temporary-billing message and is not charged.

## Stripe test-mode matrix

Test each subscription separately from a fresh Free installation:

- Flip — $4.99/month — 40 scans.
- Reseller — $9.99/month — 150 scans.
- MachZero Pro — $19.99/month — 500 scans.
- Verify active-plan users are routed to **Manage Subscription** instead of creating a second subscription.
- Verify Customer Portal opens for the attached Stripe customer.
- Trigger `invoice.paid` and confirm the monthly included-scan counter resets only when the subscription period advances.
- Trigger `invoice.payment_failed`; confirm subscription scans pause and the UI says **payment issue** while already-purchased scan-pack credits remain usable.
- Cancel/delete the subscription; confirm the installation returns to Free without deleting remaining purchased scan-pack credits.

Test each one-time pack:

- 10 scans — $2.99.
- 30 scans — $5.99.
- 100 scans — $12.99.
- Confirm refreshing or replaying the Checkout return does not add the same pack twice.

## Paid-access recovery

- After the first successful paid purchase, MachZero automatically creates and displays a recovery key once.
- Copy/share the key and confirm it uses `MZ-XXXX-XXXX-XXXX-XXXX-XXXX` format.
- On a second clean browser/device installation, choose **Restore Paid Access**, enter the key, and confirm plan, current period usage, and unused scan-pack credits move to the new installation.
- Confirm the previous installation immediately returns to Free.
- Confirm Stripe subscription metadata is changed to the new installation so later webhook events update the restored device.
- Generate a new recovery key and confirm the previous key no longer works.
- Confirm repeated invalid recovery guesses are rate-limited.

## Resale / pricing tests

Run a minimum of 10 varied test items: footwear, clothing, electronics, tools, collectibles, music gear, a damaged item, an item with a readable SKU, an item with no readable identifier, and an obscure item.

For each test confirm:

- No category/brand/condition appraisal form appears.
- One photo begins analysis automatically.
- Item identity never claims an unreadable SKU/model as fact.
- Low-confidence identification asks for one specific useful next photo.
- Results show List It, Expect, Sell Fast, Max Buy, best marketplace, confidence, and comparable/source evidence.
- Tight pricing confidence is only shown when identity and market evidence justify it.
- Share Appraisal uses the native share sheet or copy fallback and consumes no scan.

## Reverb hardening test

- Reverb Draft is hidden unless the appraisal contains a short-lived server-signed authorization token.
- Calling `/api/reverb-draft` without that token is rejected.
- Modifying the signed title/price/condition client-side cannot change the values used for the Reverb draft.
- Retrying the same successful draft returns the original draft ID instead of creating duplicate drafts.

## Android / iPhone / PWA checks

- Android Chrome: camera capture, multi-photo upload, native share, QR, PWA install, installed launch, and service-worker update.
- iPhone Safari: camera/upload, share, Add to Home Screen behavior, safe-area layout, and app icon/title.
- Clear cached data on a test install and verify the expected Free reset; on a paid test install, use the recovery key to restore access.

## Final go-live sequence

1. Pass all test-mode checks.
2. Put production Stripe Price IDs and webhook secret in Vercel.
3. Set a production `MACHZERO_SIGNING_SECRET` and `MACHZERO_ADMIN_TOKEN`.
4. Set the rotated production `REVERB_TOKEN` only if Reverb Draft is staying enabled.
5. Set `MACHZERO_BILLING_ENFORCED=true`.
6. Make the single GitHub push / Vercel deployment.
7. Immediately run one real Free scan and one low-cost live Stripe transaction, then verify entitlement and webhook state before promoting the release.
