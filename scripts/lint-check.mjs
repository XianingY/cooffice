import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];

function walkTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// 1. Keep package versions aligned across root, server and desktop.
const versions = ["package.json", "server/package.json", "desktop/package.json"].map((rel) => {
  const pkg = JSON.parse(readFileSync(join(root, rel), "utf8"));
  return { rel, version: pkg.version };
});
const baseVersion = versions[0].version;
for (const entry of versions.slice(1)) {
  if (entry.version !== baseVersion) {
    errors.push(`Version mismatch: ${entry.rel} is ${entry.version}, expected ${baseVersion}`);
  }
}

// 2. Prevent accidental console.log calls in runtime source trees (CLI scripts excluded).
const CLI_SCRIPTS = new Set(["server/src/db/seed.ts", "server/src/db/migrate.ts"]);
for (const tree of ["src", "server/src", "desktop/src"]) {
  for (const file of walkTsFiles(join(root, tree))) {
    const rel = file.slice(root.length + 1).replace(/\\/g, "/");
    if (CLI_SCRIPTS.has(rel)) continue;
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (/\bconsole\.log\s*\(/.test(line) && !line.trim().startsWith("//")) {
        errors.push(`Disallowed console.log in ${rel}:${index + 1}`);
      }
    });
  }
}

// 3. Ensure Docker deployment builds do not reintroduce double /api prefixes.
for (const rel of ["Dockerfile", "docker-compose.yml"]) {
  const text = readFileSync(join(root, rel), "utf8");
  if (/VITE_API_BASE_URL\s*[:=]\s*\/api\b/.test(text)) {
    errors.push(`${rel} sets VITE_API_BASE_URL to /api (use / to avoid /api/api/...)`);
  }
}

if (errors.length > 0) {
  for (const err of errors) process.stderr.write(`lint-check: ${err}\n`);
  process.exit(1);
}
process.stdout.write("lint-check: all invariants passed\n");
