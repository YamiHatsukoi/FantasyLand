// Generates the PWA app icons (pixel-art Mầm sprout) as PNG files in public/icons.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const half = ["........", "......kk", ".kk..kgg", "kggk.kgl", "kglgkggg", ".kgggkgg", "..kkkkkk", "....kssk",
  "...kssss", "..ksseks", "..ksssss", "..kssmss", "...kssss", "....kkss", "...kgk.k", "...kk..."];
const rows = half.map((r) => r + [...r].reverse().join(""));
const pal = { k: [27, 27, 42], g: [95, 207, 95], l: [184, 245, 154], s: [244, 230, 184], e: [27, 27, 42], m: [199, 122, 90] };
const BG = [13, 18, 16];
const RING = [42, 74, 48];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * (size * 3 + 1) + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/** Sprite occupies `frac` of the icon, centred (maskable icons keep it inside the 80% safe zone). */
function icon(size, frac) {
  const cell = Math.floor((size * frac) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  return png(size, (x, y) => {
    const sx = Math.floor((x - off) / cell), sy = Math.floor((y - off) / cell);
    const ch = sx >= 0 && sy >= 0 && sx < 16 && sy < 16 ? rows[sy][sx] : ".";
    if (ch !== ".") return pal[ch];
    const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
    return d < 0.62 ? RING : BG;
  });
}
for (const s of [192, 512]) {
  writeFileSync(`public/icons/icon-${s}.png`, icon(s, 0.62));
  writeFileSync(`public/icons/maskable-${s}.png`, icon(s, 0.5));
}
writeFileSync("public/icons/apple-touch-icon.png", icon(180, 0.62));
