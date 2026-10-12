import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const androidRoot = path.resolve(here, "..");
const repoRoot = path.resolve(androidRoot, "..");
const projectRoot = path.join(androidRoot, "android");

function read(rel) {
  return fs.readFileSync(path.join(projectRoot, rel), "utf8");
}

function write(rel, value) {
  fs.writeFileSync(path.join(projectRoot, rel), value);
}

if (!fs.existsSync(projectRoot)) {
  throw new Error("Android project is missing. Run npm run android:init first.");
}

const variablesPath = "variables.gradle";
let variables = read(variablesPath)
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
write(variablesPath, variables);

const gradlePath = "app/build.gradle";
let gradle = read(gradlePath)
  .replace(/applicationId\s*[= ]\s*["'][^"']+["']/, 'applicationId "com.cactusbyte.machzero"')
  .replace(/versionCode\s*[= ]\s*\d+/, "versionCode 1")
  .replace(/versionName\s*[= ]\s*["'][^"']+["']/, 'versionName "1.4.2"');
write(gradlePath, gradle);

const manifestPath = "app/src/main/AndroidManifest.xml";
let manifest = read(manifestPath)
  .replace(/^\s*<uses-permission[^>]+(?:READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|READ_MEDIA_VIDEO)[^>]*\/>\s*$/gm, "")
  .replace(/android:icon="@mipmap\/[^"]+"/, 'android:icon="@drawable/machzero_logo"')
  .replace(/android:roundIcon="@mipmap\/[^"]+"/, 'android:roundIcon="@drawable/machzero_logo"');

if (!manifest.includes("android:usesCleartextTraffic")) {
  manifest = manifest.replace("<application", '<application android:usesCleartextTraffic="false" android:allowBackup="false"');
} else {
  manifest = manifest.replace(/android:usesCleartextTraffic="[^"]+"/, 'android:usesCleartextTraffic="false"');
}

if (!manifest.includes('android.hardware.camera')) {
  manifest = manifest.replace("</manifest>", '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
}
write(manifestPath, manifest);

const drawableDir = path.join(projectRoot, "app/src/main/res/drawable");
fs.mkdirSync(drawableDir, { recursive: true });
fs.copyFileSync(path.join(repoRoot, "logo1.jpg"), path.join(drawableDir, "machzero_logo.jpg"));

const stylesPath = "app/src/main/res/values/styles.xml";
if (fs.existsSync(path.join(projectRoot, stylesPath))) {
  let styles = read(stylesPath).replace(/@drawable\/splash/g, "@drawable/machzero_logo");
  write(stylesPath, styles);
}

console.log("Configured MachZero Android: com.cactusbyte.machzero, versionCode 1, versionName 1.4.2, target API 36.");
