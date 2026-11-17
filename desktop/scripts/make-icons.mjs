#!/usr/bin/env node
/**
 * Generate the application icon without any image dependency:
 *  - a 1024² master PNG drawn here (gradient tile, bar chart, growth arrow)
 *  - icon.icns for macOS via `iconutil`
 *  - icon.ico for Windows via a PNG-in-ICO container
 *
 * Run `node scripts/make-icons.mjs` after changing the artwork; the generated
 * files under `build-resources/` are committed so packaging needs no tooling.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(desktopDir, "build-resources");
const SIZE = 1024;
const SAMPLES = 3; // 3×3 supersampling for smooth edges

// ---------------------------------------------------------------- geometry --
const roundRect = (x, y, w, h, r) => ({ type: "rect", x, y, w, h, r });

function insideRoundRect(px, py, shape) {
  const { x, y, w, h, r } = shape;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const lengthSquared = vx * vx + vy * vy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lengthSquared));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

const tile = roundRect(SIZE * 0.06, SIZE * 0.06, SIZE * 0.88, SIZE * 0.88, SIZE * 0.2);

const bars = [
  roundRect(SIZE * 0.235, SIZE * 0.64, SIZE * 0.125, SIZE * 0.16, SIZE * 0.028),
  roundRect(SIZE * 0.435, SIZE * 0.56, SIZE * 0.125, SIZE * 0.24, SIZE * 0.028),
  roundRect(SIZE * 0.635, SIZE * 0.48, SIZE * 0.125, SIZE * 0.32, SIZE * 0.028),
];

// Rising trend line above the bars, with an open V arrow head at the tip.
const trend = [[SIZE * 0.2, SIZE * 0.44, SIZE * 0.7, SIZE * 0.2]];
const arrowHead = [
  [SIZE * 0.7, SIZE * 0.2, SIZE * 0.606, SIZE * 0.329],
  [SIZE * 0.7, SIZE * 0.2, SIZE * 0.542, SIZE * 0.193],
];
const STROKE = SIZE * 0.042;

function background(px, py) {
  // Vertical gradient plus a soft diagonal highlight.
  const t = (px + py) / (2 * SIZE);
  const top = [56, 132, 255];
  const bottom = [17, 58, 158];
  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  return [
    mix(top[0], bottom[0], t),
    mix(top[1], bottom[1], t),
    mix(top[2], bottom[2], t),
  ];
}

function shade(px, py) {
  if (!insideRoundRect(px, py, tile)) return null;
  const base = background(px, py);

  for (const bar of bars) {
    if (insideRoundRect(px, py, bar)) {
      // Bars are white with a hint of the background showing at the bottom.
      return [255, 255, 255];
    }
  }
  for (const [ax, ay, bx, by] of [...trend, ...arrowHead]) {
    if (distanceToSegment(px, py, ax, ay, bx, by) <= STROKE / 2) return [255, 255, 255];
  }
  return base;
}

// ------------------------------------------------------------------ raster --
function render() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const step = 1 / SAMPLES;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const colour = shade(x + (sx + 0.5) * step, y + (sy + 0.5) * step);
          if (colour) {
            r += colour[0];
            g += colour[1];
            b += colour[2];
            covered += 1;
          }
        }
      }
      const offset = (y * SIZE + x) * 4;
      const total = SAMPLES * SAMPLES;
      if (covered > 0) {
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        // Partial coverage becomes alpha, giving anti-aliased tile corners.
        pixels[offset + 3] = Math.round((covered / total) * 255);
      }
    }
  }
  return pixels;
}

// -------------------------------------------------------------------- png ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------------- ico ----
function encodeIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(pngBuffers.length, 4);

  const entries = [];
  let offset = 6 + pngBuffers.length * 16;
  for (const { size, data } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((entry) => entry.data)]);
}

// ------------------------------------------------------------------- main ----
function main() {
  mkdirSync(outDir, { recursive: true });
  const master = encodePng(SIZE, render());
  const masterPath = join(outDir, "icon.png");
  writeFileSync(masterPath, master);
  console.log(`✓ ${masterPath.replace(`${desktopDir}/`, "")} (1024×1024)`);

  const ico = encodeIco([
    { size: 256, data: resizeTo(masterPath, 256) },
    { size: 128, data: resizeTo(masterPath, 128) },
    { size: 64, data: resizeTo(masterPath, 64) },
    { size: 48, data: resizeTo(masterPath, 48) },
    { size: 32, data: resizeTo(masterPath, 32) },
    { size: 16, data: resizeTo(masterPath, 16) },
  ]);
  writeFileSync(join(outDir, "icon.ico"), ico);
  console.log("✓ build-resources/icon.ico");

  if (process.platform === "darwin") {
    const work = mkdtempSync(join(tmpdir(), "whatif-iconset-"));
    try {
      const iconset = join(work, "icon.iconset");
      mkdirSync(iconset);
      const variants = [
        [16, "icon_16x16.png"],
        [32, "icon_16x16@2x.png"],
        [32, "icon_32x32.png"],
        [64, "icon_32x32@2x.png"],
        [128, "icon_128x128.png"],
        [256, "icon_128x128@2x.png"],
        [256, "icon_256x256.png"],
        [512, "icon_256x256@2x.png"],
        [512, "icon_512x512.png"],
        [1024, "icon_512x512@2x.png"],
      ];
      for (const [size, name] of variants) {
        execFileSync("sips", ["-z", String(size), String(size), masterPath, "--out", join(iconset, name)], {
          stdio: "ignore",
        });
      }
      execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(outDir, "icon.icns")]);
      console.log("✓ build-resources/icon.icns");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

/** Downscale through `sips`, falling back to the master when unavailable. */
function resizeTo(masterPath, size) {
  if (process.platform !== "darwin") return readIfExists(masterPath);
  const work = mkdtempSync(join(tmpdir(), "whatif-resize-"));
  try {
    const target = join(work, `icon-${size}.png`);
    execFileSync("sips", ["-z", String(size), String(size), masterPath, "--out", target], { stdio: "ignore" });
    return readIfExists(target);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function readIfExists(path) {
  return readFileSync(path);
}

main();
