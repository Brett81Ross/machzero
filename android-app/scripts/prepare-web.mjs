import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const androidRoot = path.resolve(here, "..");
const repoRoot = path.resolve(androidRoot, "..");
const webDir = path.join(androidRoot, "www");

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });

const copy = [
  "styles.css",
  "app-1.js",
  "app-2.js",
  "app-3.js",
  "app-4.js",
  "app-5.js",
  "logo1.jpg",
  "cactusbyte-demo.js",
  "privacy.html"
];

for (const file of copy) {
  fs.copyFileSync(path.join(repoRoot, file), path.join(webDir, file));
}

let html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
html = html
  .replace(/\s*<link rel="manifest"[^>]*>\s*/i, "\n")
  .replace(/\s*<script defer src="https:\/\/va\.vercel\.clerk\.com\/script\.js"><\/script>\s*/i, "\n")
  .replace(
    '<script defer src="/app-1.js"></script>',
    '<script>window.MACHZERO_PLAY_BUILD=true;</script>\n  <script defer src="/app-1.js"></script>'
  );
fs.writeFileSync(path.join(webDir, "index.html"), html);

let demoConfig = fs.readFileSync(path.join(repoRoot, "demo-config.js"), "utf8");
demoConfig = demoConfig
  .replace(/^.*demo-embed\.js.*$/gm, "")
  .replace(/^.*native-install\.js.*$/gm, "");
fs.writeFileSync(path.join(webDir, "demo-config.js"), demoConfig);

console.log("Prepared bundled MachZero Play web assets.");
