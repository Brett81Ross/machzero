import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const pass = [];

function check(condition, label) {
  if (condition) pass.push(label);
  else failures.push(label);
}

const pkg = JSON.parse(read("package.json"));
const html = read("index.html");
const appJs = ["app-1.js", "app-2.js", "app-3.js", "app-4.js", "app-5.js"].map(read).join("\n");
const frontend = `${html}\n${appJs}`;
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.json"));
const vercel = JSON.parse(read("vercel.json"));
const env = read(".env.example");
const reverb = read("api/reverb-draft.js");
const billing = read("api/_billing.js") + read("api/_billing-core.js") + read("api/_billing-commerce.js");
const vipHelper = read("api/_cactusbyte-vip.js");
const vipRoute = read("api/cactusbyte-vip.js");
const analyze = read("api/analyze.js");
const files = [
  "api/analyze.js",
  "api/create-checkout.js",
  "api/confirm-checkout.js",
  "api/create-portal.js",
  "api/stripe-webhook.js",
  "api/create-recovery-key.js",
  "api/restore-access.js",
  "api/reverb-draft.js",
  "api/_security.js",
  "api/_cactusbyte-vip.js",
  "api/cactusbyte-vip.js",
].map((file) => [file, read(file)]);
const source = files.map(([, value]) => value).join("\n") + frontend;

check(pkg.version === "1.4.1", "package version is 1.4.1");
check(frontend.includes('const APP_VERSION = "1.4.1"'), "frontend APP_VERSION is 1.4.1");
check(frontend.includes("v1.4.1 · Performance Release"), "visible version label is 1.4.1");
check(sw.includes("machzero-shell-v1.4.1"), "service-worker cache is versioned 1.4.1");
check(manifest.name === "MachZero™" && manifest.short_name === "MachZero", "manifest uses MachZero branding");
check(html.includes("MachZero™ · <strong>Cactus🌵Byte Studios™</strong> · All Rights Reserved"), "required footer branding is present");
check(frontend.includes("Snap it. MachZero does the rest."), "zero-input scan experience is present");
check(frontend.includes("SHARE APPRAISAL") && frontend.includes("Share MachZero™"), "app and appraisal sharing are present");
check(frontend.includes("RESTORE PAID ACCESS") && frontend.includes("CREATE RECOVERY KEY"), "paid-access recovery UI is present");
check(billing.includes("MACHZERO_BILLING_ENFORCED"), "explicit billing enforcement switch is present");
check(reverb.includes("verifyAppraisalToken") && reverb.includes("X-MachZero-Install-Id") === false, "Reverb endpoint verifies signed appraisal authorization");
check(vipHelper.includes("timingSafeEqual") && vipHelper.includes("HttpOnly") && vipHelper.includes("cactusByteVipUser"), "CactusByte VIP access uses a signed HttpOnly app-local lifetime cookie");
check(vipRoute.includes("consume-app-token") && vipRoute.includes('appId: APP_ID'), "CactusByte VIP activation validates a one-time central app token");
check(analyze.includes("cactusByteVipFromRequest") && analyze.includes('source: "cactusbyte_vip"'), "CactusByte VIP bypasses MachZero scan-credit consumption");
check(!source.match(/sk_live_[A-Za-z0-9]+|rk_live_[A-Za-z0-9]+/), "no obvious live Stripe secret is hard-coded");
check(!reverb.match(/Authorization:\s*["'`]Bearer\s+[A-Za-z0-9_-]{20,}/), "no Reverb bearer token is hard-coded");
check(env.includes("MACHZERO_SIGNING_SECRET=") && env.includes("MACHZERO_BILLING_ENFORCED=false"), "new hardening environment variables are documented");

const rewriteSources = new Set((vercel.rewrites || []).map((item) => item.source));
for (const endpoint of [
  "/api/analyze",
  "/api/create-checkout",
  "/api/confirm-checkout",
  "/api/create-portal",
  "/api/stripe-webhook",
  "/api/create-recovery-key",
  "/api/restore-access",
  "/api/reverb-draft",
  "/api/admin-metrics",
  "/api/cactusbyte-vip",
]) check(rewriteSources.has(endpoint), `Vercel rewrite exists for ${endpoint}`);

check(!read("api/get-history.js").includes("Access-Control-Allow-Origin', '*'"), "unused history endpoint no longer exposes wildcard cross-origin history");

console.log(`MachZero predeploy check: ${pass.length} passed, ${failures.length} failed.`);
for (const label of pass) console.log(`  PASS  ${label}`);
if (failures.length) {
  for (const label of failures) console.error(`  FAIL  ${label}`);
  process.exit(1);
}
