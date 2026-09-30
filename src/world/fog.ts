/**
 * Explored-tile bitmap <-> string. Explored areas are big connected blobs, so the bits are stored
 * as alternating run lengths (unexplored, explored, ...) in varints, then base64 with a "~" prefix.
 * Plain base64 bitsets from older saves still decode.
 */
export function decodeFog(s: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  if (!s) return out;
  if (s[0] === "~") {
    const bin = atob(s.slice(1));
    let pos = 0, bit = 0, i = 0;
    while (i < bin.length && pos < size) {
      let n = 0, shift = 0, c: number;
      do { c = bin.charCodeAt(i++); n |= (c & 127) << shift; shift += 7; } while (c & 128 && i < bin.length);
      if (bit) out.fill(1, pos, Math.min(size, pos + n));
      pos += n;
      bit ^= 1;
    }
    return out;
  }
  const bin = atob(s);
  for (let i = 0; i < size; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

export function encodeFog(fog: Uint8Array): string {
  const bytes: number[] = [];
  const varint = (n: number) => { do { let b = n & 127; n >>>= 7; if (n) b |= 128; bytes.push(b); } while (n); };
  let bit = 0, run = 0;
  for (let i = 0; i < fog.length; i++) {
    const v = fog[i] ? 1 : 0;
    if (v === bit) { run++; continue; }
    varint(run);
    bit = v;
    run = 1;
  }
  if (run && bit) varint(run); // a trailing unexplored run is implied
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `~${btoa(bin)}`;
}
