import { SPRITES } from "./sprites";
import { tint } from "../data/enemies";
import { creatureCanvas, parseCreature } from "./creatures";
import { isPerson, portraitCanvas } from "./people";

const cache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function key(id: string, pal?: Record<string, string>) {
  return pal ? `${id}|${JSON.stringify(pal)}` : id;
}

/** Returns a 16x16 canvas for a sprite (optionally recoloured). */
export function spriteCanvas(id: string, pal?: Record<string, string>): HTMLCanvasElement {
  const k = key(id, pal);
  const hit = cache.get(k);
  if (hit) return hit;
  const cr = parseCreature(id);
  if (cr) return creatureCanvas(cr);
  if (isPerson(id)) return portraitCanvas(id, pal);
  const def = SPRITES[id] ?? SPRITES.slime;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  const colors: Record<string, string> = { ...def.pal };
  if (pal) {
    const t = pal.__tint;
    if (t) for (const ch of Object.keys(colors)) if (ch !== "k" && ch !== "e") colors[ch] = tint(colors[ch], t, 0.5);
    for (const [ch, col] of Object.entries(pal)) if (ch !== "__tint") colors[ch] = col;
  }
  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(k, c);
  return c;
}

/** Data URL of an upscaled sprite, for use in <img> tags. */
export function spriteURL(id: string, pal?: Record<string, string>, scale = 4): string {
  const k = `${key(id, pal)}@${scale}`;
  const hit = urlCache.get(k);
  if (hit) return hit;
  const src = spriteCanvas(id, pal);
  const c = document.createElement("canvas");
  c.width = 16 * scale;
  c.height = 16 * scale;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL();
  urlCache.set(k, url);
  return url;
}

export function spriteImg(id: string, pal?: Record<string, string>, cls = "sprite"): HTMLImageElement {
  const img = new Image();
  img.src = spriteURL(id, pal);
  img.className = cls;
  img.alt = "";
  img.draggable = false;
  return img;
}
