#!/usr/bin/env node
/**
 * Build an installable artifact for the current platform.
 *
 *   node scripts/package.mjs            # dmg/zip on macOS, nsis on Windows
 *   node scripts/package.mjs --dir      # unpacked app only (fast smoke test)
 *   node scripts/package.mjs --mac x64  # explicit platform/arch
 *
 * The staging step has already run as part of `npm run desktop:dist`; this
 * script only wraps electron-builder with the repository's conventions.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dirOnly = args.includes("--dir");
const platformFlag = args.find((arg) => ["--mac", "--win", "--linux"].includes(arg));
const arch = args.find((arg) => ["arm64", "x64", "universal"].includes(arg));

if (!existsSync(join(desktopDir, "build", "server", "dist", "desktop", "embed.js"))) {
  console.error("\n✗ 运行时尚未准备，请先运行 npm run desktop:stage\n");
  process.exit(1);
}
if (!existsSync(join(desktopDir, "dist", "main", "index.js"))) {
  console.error("\n✗ 主进程尚未编译，请先运行 npm --prefix desktop run build\n");
  process.exit(1);
}

const platform = platformFlag ?? (process.platform === "darwin" ? "--mac" : process.platform === "win32" ? "--win" : "--linux");
const passthrough = args.filter((arg) => arg !== "--dir" && arg !== platformFlag && arg !== arch);
const archFlag = arch ? [`--${arch}`] : [];

console.log(`· packaging ${platform.replace("--", "")}${dirOnly ? " (unpacked)" : ""} …`);
execFileSync(
  join(desktopDir, "node_modules", ".bin", "electron-builder"),
  ["--config", "electron-builder.yml", platform, ...archFlag, ...(dirOnly ? ["--dir"] : []), ...passthrough],
  { cwd: desktopDir, stdio: "inherit" },
);
const outputArg = args.find((arg) => arg.startsWith("--config.directories.output="));
const outputDir = outputArg ? outputArg.slice("--config.directories.output=".length) : join(desktopDir, "release");
const metadataPath = join(outputDir, "latest-mac.yml");
if (process.platform === "darwin" && existsSync(metadataPath)) {
  // A stale metadata file would advertise an old version and hash at the feed,
  // so refusing to finish is safer than uploading a mismatched pair.
  const metadataVersion = readFileSync(metadataPath, "utf8").match(/^version:\s*(.+)$/m)?.[1]?.trim();
  const packageVersion = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8")).version;
  if (metadataVersion !== packageVersion) {
    console.error(`\n✗ latest-mac.yml 版本 ${metadataVersion} 与 package.json ${packageVersion} 不一致\n`);
    process.exit(1);
  }
}
console.log(`✓ artefacts in ${outputDir}`);
