#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const mode = args.has("--web") ? "web" : args.has("--full") ? "full" : "all";

function run(cmd, cmdArgs, cwd = root) {
  process.stdout.write(`\n==> (${cwd === root ? "root" : cwd.replace(`${root}/`, "")}) ${cmd} ${cmdArgs.join(" ")}\n`);
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
}

run("npm", ["ci"]);

if (mode === "full" || mode === "all") {
  const serverDir = join(root, "server");
  run("npm", ["ci"], serverDir);
  const envExample = join(serverDir, ".env.example");
  const envTarget = join(serverDir, ".env");
  if (!existsSync(envTarget) && existsSync(envExample)) {
    copyFileSync(envExample, envTarget);
    process.stdout.write("==> Created server/.env from server/.env.example\n");
  }
  run("npm", ["run", "server:migrate"]);
}

if (mode === "all") {
  run("npm", ["install"], join(root, "desktop"));
}

process.stdout.write(`\n✓ Setup (${mode}) complete.\n`);
