import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const androidRoot = path.resolve(here, "..");
const repoRoot = path.resolve(androidRoot, "..");

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");
const failures = [];
const pass = [];
const check = (condition, label) => (condition ? pass : failures).push(label);

const app1 = read("app-1.js");
const app2 = read("app-2.js");
const app3 = read("app-3.js");
const app4 = read("app-4.js");
const app5 = read("app-5.js");
const index = read("index.html");
const demo = read("demo-config.js");
const privacy = read("privacy.html");
const prepare = read("android-app/scripts/prepare-web.mjs");
const configure = read("android-app/scripts/configure-android.mjs");
const config = JSON.parse(read("android-app/capacitor.config.json"));
const pkg = JSON.parse(read("android-app/package.json"));

check(config.appId === "com.cactusbyte.machzero", "package id is com.cactusbyte.machzero");
check(pkg.version === "1.4.2", "Android wrapper version is 1.4.2");
check(pkg.dependencies?.["@capacitor/android"]?.startsWith("^8."), "Capacitor Android 8 is pinned");
check(pkg.dependencies?.["@capacitor/share"]?.startsWith("^8."), "native Share plugin is included");
check(config.plugins?.CapacitorHttp?.enabled === true, "native HTTP bridge is enabled");
check(app1.includes("PLAY_BUILD") && app1.includes("NATIVE_API_ORIGIN"), "Play runtime flag and API origin are present");
check(app1.includes("platformShare") && app1.includes("Plugins?.Share"), "native Share bridge is present");
check([app2, app3, app4].every((file) => file.includes("apiUrl(")), "native API calls are routed through apiUrl");
check(app4.includes("if (PLAY_BUILD)") && app4.includes("New purchases are disabled in the Google Play test build"), "Play build blocks Stripe purchases");
check(app3.includes("Google Play test build does not offer new purchases"), "Play billing UI hides new purchases");
check(app5.includes("https://machzero-beta.vercel.app/"), "native sharing uses the public MachZero URL");
check(demo.includes("!window.Capacitor?.isNativePlatform?.()"), "native build blocks website APK installer");
check(index.includes('href="/privacy.html"'), "privacy policy is linked in-app");
check(privacy.includes("MachZero™ Privacy Policy"), "privacy policy exists");
check(prepare.includes("MACHZERO_PLAY_BUILD=true"), "packaging injects Play build flag");
check(prepare.includes("va\\.vercel\\.clerk\\.com"), "packaging strips web analytics from Play shell");
check(prepare.includes("native-install\\.js"), "packaging strips native installer helper");
check(configure.includes("targetSdkVersion = 36") && configure.includes("compileSdkVersion = 36"), "Android 16 / API 36 target is enforced");
check(configure.includes("versionCode 1") && configure.includes('versionName "1.4.2"'), "Play version code/name are enforced");
check(configure.includes("READ_MEDIA_IMAGES") && configure.includes("READ_MEDIA_VIDEO"), "broad media permissions are actively removed if generated");
check(configure.includes('android:usesCleartextTraffic="false"'), "cleartext traffic is disabled");
check(configure.includes('android:allowBackup="false"'), "Android app-data backup is disabled");
check(configure.includes('android.hardware.camera') && configure.includes('android:required="false"'), "camera hardware is optional");

console.log(`MachZero Play check: ${pass.length} passed, ${failures.length} failed.`);
for (const label of pass) console.log(`  PASS  ${label}`);
if (failures.length) {
  for (const label of failures) console.error(`  FAIL  ${label}`);
  process.exit(1);
}
