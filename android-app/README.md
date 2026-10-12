# MachZero™ Android / Google Play

This directory contains the isolated Android wrapper for MachZero™. It does not change how the normal Vercel website is built.

## Identity

- App name: MachZero
- Package ID: `com.cactusbyte.machzero`
- Version name: `1.4.2`
- Version code: `1`
- Minimum Android SDK: 24
- Compile / target SDK: 36 (Android 16)
- Publishing format: Android App Bundle (`.aab`)

## Architecture

The Play build packages the MachZero HTML/CSS/JavaScript shell locally with Capacitor 8. API requests are sent to the production MachZero HTTPS backend through Capacitor's native HTTP bridge.

The Play build adds native sharing through `@capacitor/share` and uses the existing system photo chooser / camera capture flow. It does not request broad photo-library permissions.

The build flag `window.MACHZERO_PLAY_BUILD=true` is injected only into the bundled Play assets. That flag:

- hides new Stripe purchase controls inside the Play build;
- prevents Stripe checkout and Stripe subscription-management flows from opening;
- keeps restore-existing-access through MachZero recovery keys;
- shares the public MachZero website URL instead of a local Capacitor URL;
- prevents the website APK installer helper from loading.

The normal website keeps its current Stripe behavior.

## Generate locally

Requirements: Node 22+, Android Studio compatible with Capacitor 8, Android SDK 36.

From this directory:

```bash
npm install
npm run android:init
cd android
./gradlew bundleRelease
```

On Windows, use `gradlew.bat bundleRelease`.

The generated AAB is under:

`android/app/build/outputs/bundle/release/`

## GitHub build

Run the **MachZero Android Play Bundle** workflow manually.

Without signing secrets, the workflow produces an unsigned validation bundle named **UNSIGNED-DO-NOT-UPLOAD**.

For a Play-uploadable signed bundle, configure these GitHub Actions secrets:

- `MACHZERO_UPLOAD_KEYSTORE_B64`
- `MACHZERO_UPLOAD_KEY_ALIAS`
- `MACHZERO_UPLOAD_KEYSTORE_PASSWORD`
- `MACHZERO_UPLOAD_KEY_PASSWORD`

Never commit the keystore or its passwords.

## Before Play upload

1. Run the web release QA gate.
2. Build the AAB and install/test an APK on a physical Android device.
3. Verify camera capture, photo picker, AI appraisal, native Share, marketplace links, recovery-key restore, rotation/foldable layout, and back navigation.
4. Confirm new Stripe purchases are not offered in the Play build.
5. Confirm `https://machzero-beta.vercel.app/privacy.html` is publicly reachable after the approved web deployment.
6. Upload only a **SIGNED** AAB.
