import { hashString, Rng } from "../core/rng";
import { BIOMES } from "../world/biomes";
import { hs, mix } from "./palette";
import { T, TS, tileSet } from "./tiles";

/**
 * Battle scenery for a biome, painted once: sky, two layers of distant hills, a tree line on the
 * horizon, and the biome's own ground receding into the distance with a lit clearing in front.
 */
const W = 384, H = 216, HORIZON = 98;
const cache = new Map<string, string>();

export function battleBackdrop(biomeId: string): string {
  const hit = cache.get(biomeId);
  if (hit) return hit;
  const b = BIOMES[biomeId] ?? BIOMES.forest;
  const set = tileSet(b);
  const rng = new Rng(hashString(`bd:${b.id}`));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;

  // ---- sky
  const top = hs(b.bg[0], -0.25);
  const horizon = mix(b.bg[1], b.night ? "#6a5a9a" : "#fff4d8", b.night ? 0.25 : 0.35);
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, top);
  sky.addColorStop(1, horizon);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, HORIZON + 4);
  if (b.night) {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${rng.range(0.25, 0.9)})`;
      g.fillRect(rng.int(0, W - 1), rng.int(0, HORIZON - 30), 1, 1);
    }
  } else {
    // a few soft pixel clouds
    for (let i = 0; i < 5; i++) {
      const cx = rng.int(0, W), cy = rng.int(10, 50), w = rng.int(26, 60);
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.fillRect(cx, cy, w, 4);
      g.fillRect(cx + 6, cy - 3, w - 14, 3);
    }
  }

  // ---- distant hills (two layers, hazier further away)
  const ridge = (base: number, amp: number, col: string, f: number) => {
    const ph = rng.range(0, 10);
    g.fillStyle = col;
    for (let x = 0; x < W; x++) {
      const y = Math.round(base - amp * (0.6 * Math.sin(x * f + ph) + 0.4 * Math.sin(x * f * 2.7 + ph * 1.7)));
      g.fillRect(x, y, 1, H - y);
    }
  };
  ridge(HORIZON - 14, 12, mix(b.wall[0], horizon, 0.62), 0.018);
  ridge(HORIZON - 4, 7, mix(b.obs[0], horizon, 0.38), 0.035);

  // ---- tree line / rocks on the horizon, small and hazy
  const fog = mix(b.obs[0], horizon, 0.3);
  for (let x = -8; x < W; x += rng.int(10, 18)) {
    const tall = set.tall[rng.int(0, set.tall.length - 1)];
    const s = rng.range(0.55, 0.8);
    g.globalAlpha = 0.9;
    g.drawImage(tall, x, HORIZON + 6 - 48 * s, 32 * s, 48 * s);
  }
  g.globalAlpha = 1;
  g.fillStyle = fog;
  g.globalAlpha = 0.35;
  g.fillRect(0, HORIZON - 30, W, 36);
  g.globalAlpha = 1;

  // ---- ground: tile pattern squeezed toward the horizon (fake perspective)
  const pat = document.createElement("canvas");
  pat.width = TS * 24;
  pat.height = TS * 10;
  const pg = pat.getContext("2d")!;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 24; x++) {
      const r = hashString(`${b.id}${x},${y}`);
      const kind = r % 11 === 0 ? T.DECOR : T.GROUND;
      pg.drawImage(set.tiles[kind][r % set.tiles[kind].length], x * TS, y * TS);
    }
  }
  const gy0 = HORIZON + 2;
  let sy = 0;
  for (let y = gy0; y < H; y++) {
    const t = (y - gy0) / (H - gy0);
    const scale = 0.28 + 0.9 * t; // pixels of screen per pixel of texture
    const srcW = W / scale;
    const sx = (pat.width - srcW) / 2;
    g.drawImage(pat, Math.max(0, sx), Math.floor(sy) % pat.height, Math.min(pat.width, srcW), 1, 0, y, W, 1);
    sy += 1 / scale;
  }
  // haze where the ground meets the hills, darkness toward the viewer's feet
  const haze = g.createLinearGradient(0, gy0 - 2, 0, gy0 + 30);
  haze.addColorStop(0, `${horizon}cc`);
  haze.addColorStop(1, `${horizon}00`);
  g.fillStyle = haze;
  g.fillRect(0, gy0 - 2, W, 32);
  // a lit clearing where the fight happens
  const glow = g.createRadialGradient(W / 2, H * 0.78, 10, W / 2, H * 0.78, W * 0.62);
  glow.addColorStop(0, b.night ? "rgba(180,170,255,0.10)" : "rgba(255,245,200,0.16)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, gy0, W, H - gy0);
  const shade = g.createLinearGradient(0, gy0, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = shade;
  g.fillRect(0, gy0, W, H - gy0);

  const url = c.toDataURL();
  cache.set(biomeId, url);
  return url;
}
