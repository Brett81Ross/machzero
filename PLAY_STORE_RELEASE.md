# MachZero™ Google Play Release Packet

## Release identity

- Store title: **MachZero: Resale Evaluator**
- Developer: **Cactus🌵Byte Studios™**
- Android package: **com.cactusbyte.machzero**
- Initial Play version: **1.4.2 (version code 1)**
- Target SDK: **Android 16 / API 36**
- Minimum SDK: **API 24**
- App bundle: **AAB**
- Ads: **No**
- Recommended target audience for the first release: **Adults / 18+**
- Privacy-policy URL after the approved web deployment: **https://machzero-beta.vercel.app/privacy.html**

## Short description

Snap a photo. Get resale pricing, profit targets, comps, and listing copy.

## Full description

MachZero™ turns item photos into a practical resale decision.

Snap an item or choose photos you already have. MachZero analyzes visible brand, model, condition, identifiers, accessories, and market evidence, then returns a resale price ladder designed for sourcing and listing decisions.

MachZero can show:

- Recommended List It price
- Expected sale price
- Sell Fast price
- Max Buy target
- Estimated profit at your buy cost
- Best marketplace
- Identification and pricing confidence
- Condition evidence
- Comparable market evidence and source links
- Ready-to-list title and description

If one more photo would materially improve the answer, MachZero asks for that specific photo and refines the same appraisal.

MachZero is built by Cactus🌵Byte Studios™.

Pricing is an estimate based on available evidence and market information. Actual sale prices, marketplace fees, shipping costs, taxes, and demand can vary.

## Play-build payment behavior

The initial Google Play test build does **not** offer new Stripe purchases or Stripe subscription-management links inside the Android app.

It supports the Free scan allowance and can restore MachZero paid access that already exists through a private recovery key. Do not enable in-app Stripe purchase CTAs in the Play build unless the app is enrolled in and fully implements an applicable Google Play alternative-billing program.

If MachZero later sells subscriptions or scan packs directly inside the Play app, implement Google Play Billing or an eligible approved alternative-billing flow before enabling those controls.

## Permissions / device access

The intended Play build does not request:

- precise or approximate location
- microphone
- contacts
- SMS or call logs
- broad `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` access
- broad external-storage access

Users select individual item photos through the system chooser or camera flow. Camera hardware is marked optional so gallery-only devices are not excluded.

## Data Safety draft

This is a preparation draft; confirm the final answers against the exact signed AAB and production providers in Play Console.

### Data collected for app functionality

**Photos**
- User-selected item photos are transmitted off-device for the requested appraisal.
- Purpose: app functionality.
- Required only when the user requests an appraisal.
- Not sold for advertising.
- MachZero does not intentionally persist submitted image payloads in its application database after processing; infrastructure/AI providers may process or temporarily retain request data under their service terms.

**Device or other IDs**
- MachZero generates a random installation ID.
- Purpose: scan metering, entitlement state, recovery, abuse prevention, and service operation.

**Purchase / entitlement information**
- If a user restores existing paid access, MachZero processes plan/scan entitlement state associated with the installation.
- Full card numbers are not stored by MachZero.

### Third-party processing

Item photos and appraisal context are sent to the AI provider used by MachZero for the requested evaluation. Hosting, storage, and payment providers process data required to operate their respective services.

Google's 2026 User Data policy clarification explicitly applies user-data requirements to third-party AI integrations, so the final Data Safety form and privacy policy must accurately describe this processing.

### Security

- Network requests use HTTPS.
- Recovery keys are stored server-side only as cryptographic hashes.
- No advertising SDK is intentionally included in the Play build.
- The Play packaging step strips the Vercel web-analytics script from the bundled Android shell.

## Store-content / rating notes

- Core purpose: resale utility / shopping-support tool.
- No user-to-user chat.
- No public user-generated-content feed.
- No gambling.
- No sexual content.
- No location tracking.
- AI output is generated from user-selected item photos and market evidence.
- Complete the IARC questionnaire truthfully from the actual release build.

## Required release evidence

Capture current screenshots from the signed Play build on a physical Android device:

1. MachZero home / Snap Item
2. Photo preview while preparing an appraisal
3. Price ladder results
4. Resale decision / Max Buy
5. Comparable evidence
6. Ready-to-list copy + marketplace buttons
7. Native Android Share sheet

Recommended feature graphic: 1024 × 500.
Recommended app icon source: existing MachZero logo; verify final adaptive-icon crop in Android Studio / Play preview.

## Release gates

Do not submit to Play until:

- the signed AAB builds successfully;
- the physical-device camera/photo flow works;
- native Share opens the Android chooser;
- AI scans complete against the production API;
- no Stripe purchase or external payment CTA appears in the Play build;
- the privacy-policy URL is public;
- Data Safety answers match the signed artifact;
- content rating is completed;
- the app passes the Play Console pre-launch report;
- any closed-testing requirement shown by this developer account is completed.
