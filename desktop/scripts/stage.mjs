#!/usr/bin/env node
/**
 * Assemble the runtime payload that both `electron .` and the installed app
 * load:
 *
 *   desktop/build/web      built renderer (index.html + assets)
 *   desktop/build/server   compiled API + production node_modules
 *
 * The API's dependencies are installed here rather than linked from
 * `server/node_modules` because better-sqlite3 has to be compiled against the
 * Electron ABI, which would otherwise break `npm --prefix server test` under
 * the system Node.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(desktopDir, "..");
const buildDir = join(desktopDir, "build");
const buildServer = join(buildDir, "server");
const buildWeb = join(buildDir, "web");

const args = new Set(process.argv.slice(2));
const skipInstall = args.has("--skip-install");

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** Bulk removal through the CLI; keeps large trees out of the JS fs path. */
function resetDir(dir) {
  if (!existsSync(dir)) return;
  execFileSync("rm", ["-rf", dir], { stdio: "inherit" });
}

function listFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out;
}

/** Mirror `from` into `to` without ever deleting more than a handful of files. */
function syncDir(from, to, label) {
  if (!existsSync(from)) fail(`${label} 缺失：${from}\n  请先运行 npm run build / npm run server:build`);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
  const wanted = new Set(listFiles(from));
  const stale = listFiles(to).filter((file) => !wanted.has(file));
  for (const file of stale) rmSync(join(to, file), { force: true });
  console.log(`✓ ${label} → ${to.replace(`${repoRoot}/`, "")}${stale.length ? ` (removed ${stale.length} stale)` : ""}`);
}

function electronVersion() {
  const pkg = JSON.parse(readFileSync(join(desktopDir, "node_modules", "electron", "package.json"), "utf8"));
  return pkg.version;
}

function lockHash() {
  const lock = readFileSync(join(repoRoot, "server", "package-lock.json"));
  return createHash("sha256").update(lock).digest("hex").slice(0, 16);
}

function main() {
  if (!existsSync(join(desktopDir, "node_modules", "electron", "package.json"))) {
    fail("desktop 依赖尚未安装，请先运行 npm --prefix desktop install");
  }
  const version = electronVersion();
  mkdirSync(buildDir, { recursive: true });

  syncDir(join(repoRoot, "dist"), buildWeb, "renderer");
  syncDir(join(repoRoot, "server", "dist"), join(buildServer, "dist"), "api build");
  for (const file of ["package.json", "package-lock.json"]) {
    cpSync(join(repoRoot, "server", file), join(buildServer, file));
  }
  console.log("✓ api package manifest copied");

  const stampFile = join(buildServer, ".stamp");
  const wanted = `${version}:${lockHash()}`;
  const current = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : "";
  const nativeBinary = join(buildServer, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");

  if (skipInstall && existsSync(nativeBinary)) {
    console.log("✓ dependencies: skipped (--skip-install)");
    return;
  }
  if (current === wanted && existsSync(nativeBinary)) {
    console.log(`✓ dependencies: up to date (electron ${version})`);
    return;
  }

  // A previous from-source build leaves object files behind; node-gyp would
  // have to delete them, so start from an empty tree instead.
  resetDir(join(buildServer, "node_modules"));

  console.log(`· installing production dependencies (electron ${version} ABI) …`);
  execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: buildServer,
    stdio: "inherit",
  });

  console.log("· rebuilding native modules against the electron ABI …");
  execFileSync(
    join(desktopDir, "node_modules", ".bin", "electron-rebuild"),
    ["-f", "-w", "better-sqlite3", "--module-dir", buildServer, "--version", version],
    { cwd: desktopDir, stdio: "inherit" },
  );

  if (!existsSync(nativeBinary)) fail("better-sqlite3 原生模块未生成，请检查 electron-rebuild 输出");
  writeFileSync(stampFile, `${wanted}\n`, "utf8");
  console.log("✓ dependencies: rebuilt for electron");
}

main();
