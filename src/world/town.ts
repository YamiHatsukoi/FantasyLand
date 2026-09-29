import { Rng, hashString } from "../core/rng";
import { addItem, charStats, giveXp, healParty, logMsg, removeItem, type CropState, type GameState, type PlacedBuilding, type PlotState, type Weather } from "../core/state";
import { BUILDINGS, MAX_TERRITORY_FOR_RANK, RANK_NAMES } from "../data/buildings";
import { BIOME_MATS, CROPS, CROP_LIST, METALS, getItem, metalTierForFloor, seasonOf, type CropDef } from "../data/items";
import { getFloor } from "../world/floors";

// ------------------------------------------------------------ settlement stats
export const rankOf = (g: GameState) => g.buildings.find((b) => b.type === "house")?.level ?? 1;
export const rankName = (g: GameState) => RANK_NAMES[rankOf(g)];
export const maxTerritory = (g: GameState) => MAX_TERRITORY_FOR_RANK[rankOf(g)];

export function housing(g: GameState) {
  return g.buildings.reduce((s, b) => s + (BUILDINGS[b.type]?.housing ?? 0) * b.level, 0);
}
export function appeal(g: GameState) {
  return g.buildings.reduce((s, b) => s + (BUILDINGS[b.type]?.appeal ?? 0) * b.level, 0);
}
export const residents = (g: GameState) => Object.keys(g.chars).length - 1; // recruits live in town
export const population = (g: GameState) => g.settlers + residents(g) + 1;
export function workersNeeded(g: GameState) {
  return g.buildings.reduce((s, b) => s + (BUILDINGS[b.type]?.workers ?? 0) * b.level, 0);
}
export function efficiency(g: GameState) {
  const need = workersNeeded(g);
  const have = g.settlers + Math.floor(residents(g) / 2);
  return need === 0 ? 1 : Math.min(1, have / need);
}

// ------------------------------------------------------------ farming helpers
export const WEATHER: Record<Weather, { name: string; icon: string }> = {
  sun: { name: "Nắng", icon: "☀️" }, cloud: { name: "Nhiều mây", icon: "⛅" }, rain: { name: "Mưa", icon: "🌧️" },
  storm: { name: "Giông bão", icon: "⛈️" }, snow: { name: "Tuyết", icon: "🌨️" },
};
export const isWet = (w: Weather) => w === "rain" || w === "storm" || w === "snow";

export function rollWeather(g: GameState, day: number): Weather {
  const rng = new Rng(hashString(`${g.flags.seed}:weather:${day}`));
  const season = seasonOf(day);
  const r = rng.next();
  if (season === 3) return r < 0.3 ? "snow" : r < 0.55 ? "cloud" : "sun";
  const rain = [0.32, 0.2, 0.28][season];
  if (r < rain * 0.25) return "storm";
  if (r < rain) return "rain";
  return r < rain + 0.25 ? "cloud" : "sun";
}

export function cropTarget(c: CropState): number {
  const def = CROPS[c.id];
  return c.harvests > 0 && def.regrow ? def.regrow : def.days;
}
export const isReady = (c?: CropState) => !!c && c.growth >= cropTarget(c) - 1e-6;
export function cropStage(c?: CropState): number {
  if (!c) return -1;
  if (isReady(c)) return 3;
  return Math.min(2, Math.floor((c.growth / cropTarget(c)) * 3));
}

export const SOIL_NAMES = ["Đất Cằn", "Đất Thường", "Đất Màu Mỡ", "Linh Thổ"];

export function plant(plot: PlotState, cropId: string) {
  plot.crop = { id: cropId, growth: 0, harvests: 0, perfect: true };
}

/** Harvest a plot. Returns items gained. */
export function harvest(g: GameState, plot: PlotState, rng: Rng): Record<string, number> {
  const c = plot.crop!;
  const def = CROPS[c.id];
  let n = rng.int(def.yield[0], def.yield[1]) + (plot.soil >= 2 ? 1 : 0) + (plot.soil >= 3 ? 1 : 0);
  if (c.perfect) n = Math.ceil(n * 1.5);
  const out: Record<string, number> = { [def.id]: n };
  if (!def.regrow && rng.chance(def.hybrid ? 0.35 : 0.25)) out[def.seed] = 1;
  if (rng.chance(0.3)) out.compost = 1;
  for (const [id, k] of Object.entries(out)) addItem(g, id, k);
  if (def.regrow) {
    c.harvests++;
    c.growth = 0;
    c.perfect = true;
  } else {
    plot.crop = undefined;
    plot.soil = Math.max(0, plot.soil - 1);
  }
  return out;
}

export function applyFertilizer(plot: PlotState, itemId: string): string {
  const f = getItem(itemId).fert!;
  const before = plot.soil;
  plot.soil = Math.min(3, Math.max(plot.soil, 0) + f.soil);
  if (f.speed && plot.crop) plot.crop.growth += f.speed;
  return `${SOIL_NAMES[before]} → ${SOIL_NAMES[plot.soil]}${f.speed && plot.crop ? `, cây lớn thêm ${f.speed} ngày` : ""}`;
}

export function allPlots(g: GameState): { b: PlacedBuilding; plot: PlotState; greenhouse: boolean }[] {
  const out: { b: PlacedBuilding; plot: PlotState; greenhouse: boolean }[] = [];
  for (const b of g.buildings) {
    if (b.type === "farm" && b.plot) out.push({ b, plot: b.plot, greenhouse: false });
    if (b.type === "greenhouse") for (const p of ensureSlots(b)) out.push({ b, plot: p, greenhouse: true });
  }
  return out;
}

export function ensureSlots(b: PlacedBuilding): PlotState[] {
  const n = 2 + b.level * 2;
  b.slots ??= [];
  while (b.slots.length < n) b.slots.push({ soil: 1, watered: true });
  return b.slots;
}

function sprinklerCovers(g: GameState, b: PlacedBuilding) {
  return g.buildings.some((s) => s.type === "sprinkler" && Math.max(Math.abs(s.x - b.x), Math.abs(s.y - b.y)) <= s.level);
}

const GRAINS = ["wheat", "gold_corn", "rice", "crystal_rice"];
const FODDER = ["cloud_cabbage", "frost_cabbage", "holy_potato", "moon_radish", "wheat", "gold_corn", "ember_carrot", "blood_beet", "snow_root"];
const LEAVES = ["cloud_cabbage", "frost_cabbage", "dew_tea", "wind_mint"];

function eat(g: GameState, pool: string[], n: number): number {
  let got = 0;
  for (const id of pool) {
    while (got < n && (g.inventory[id] ?? 0) > 0) { removeItem(g, id, 1); got++; }
    if (got >= n) break;
  }
  return got;
}

// ------------------------------------------------------------ the daily tick
export interface DayReport {
  lines: string[];
  gains: Record<string, number>;
}

/** Called when the player sleeps: advances the calendar and runs the whole settlement. */
export function advanceDay(g: GameState): DayReport {
  const rng = new Rng(hashString(`${g.flags.seed}:day:${g.day}`));
  const lines: string[] = [];
  const gains: Record<string, number> = {};
  const gain = (id: string, n: number) => {
    if (n <= 0) return;
    n = Math.max(1, Math.round(n));
    addItem(g, id, n);
    gains[id] = (gains[id] ?? 0) + n;
  };
  const season = seasonOf(g.day);
  const wetToday = isWet(g.weather);

  // --- crops grow (for the day that just ended)
  let grown = 0, dry = 0;
  for (const { b, plot, greenhouse } of allPlots(g)) {
    const c = plot.crop;
    if (c) {
      const def = CROPS[c.id];
      const watered = greenhouse || plot.watered || wetToday || sprinklerCovers(g, b);
      const inSeason = greenhouse || def.seasons.includes(season);
      let m = (inSeason ? 1 : 0.4) * (1 + 0.12 * plot.soil);
      if (!watered) {
        if (def.water === 2) m = 0;
        else if (def.water === 1) m *= 0.5;
        if (def.water > 0) { c.perfect = false; dry++; }
      }
      c.growth += m;
      grown++;
    }
    plot.watered = greenhouse;
  }

  // --- cross-pollination: empty plots next to two ripe parent crops may sprout a hybrid
  const farmAt = new Map(g.buildings.filter((b) => b.type === "farm").map((b) => [`${b.x},${b.y}`, b]));
  for (const b of farmAt.values()) {
    if (!b.plot || b.plot.crop) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      .map(([dx, dy]) => farmAt.get(`${b.x + dx},${b.y + dy}`)?.plot?.crop)
      .filter((c): c is CropState => !!c && isReady(c))
      .map((c) => c.id);
    for (const h of CROP_LIST.filter((c) => c.hybrid)) {
      if (near.includes(h.hybrid![0]) && near.includes(h.hybrid![1]) && rng.chance(0.12)) {
        plant(b.plot, h.id);
        lines.push(`🧬 Lai giống thành công! Một mầm ${h.name} mọc lên giữa ruộng.`);
        break;
      }
    }
  }

  // --- settlement production
  const eff = efficiency(g);
  const whBonus = 1 + 0.1 * (g.buildings.find((b) => b.type === "warehouse")?.level ?? 0);
  const fedBefore = feedSettlers(g, lines);
  const prod = eff * whBonus * (fedBefore ? 1 : 0.6);
  const unlockedBiomes = unlockedBiomeIds(g);
  let flowersNear = 0;
  for (const b of g.buildings) {
    const L = b.level;
    switch (b.type) {
      case "lumber":
        gain("wood", 3 * L * prod);
        if (L >= 2) gain(BIOME_MATS[rng.pick(unlockedBiomes)].wood, (L - 1) * 1.5 * prod);
        break;
      case "quarry":
        gain("stone", 3 * L * prod);
        gain("sand", L * prod);
        if (L >= 2) gain("clay", L * prod);
        if (L >= 3) gain(BIOME_MATS[rng.pick(unlockedBiomes)].stone, (L - 2) * 2 * prod);
        break;
      case "mine": {
        const top = Math.min(L + 1, metalTierForFloor(Math.max(1, g.maxFloor)) + 1, METALS.length);
        gain(METALS[0].ore, (2 + L) * prod);
        for (let t = 2; t <= top; t++) gain(METALS[t - 1].ore, Math.max(0.5, (top - t + 1) * 0.8) * prod);
        if (rng.chance(0.08 * L)) gain("mana_crystal", 1);
        break;
      }
      case "herbgarden":
        gain("herb", 2 * L * prod);
        gain(BIOME_MATS[rng.pick(unlockedBiomes)].herb, L * prod);
        if (L >= 2) gain("silver_herb", (L - 1) * prod);
        break;
      case "coop": {
        const fed = eat(g, GRAINS, L);
        const f = fed >= L ? 1 : 0.5;
        gain("egg", 2 * L * f * prod);
        if (L >= 2) gain("duck_egg", (L - 1) * f * prod);
        if (fed < L) lines.push("🐔 Gà vịt thiếu thức ăn (cần lúa/ngô) — sản lượng giảm một nửa.");
        break;
      }
      case "barn": {
        const fed = eat(g, FODDER, 2 * L);
        const f = fed >= 2 * L ? 1 : 0.5;
        gain("milk", 2 * L * f * prod);
        if (L >= 2) gain("goat_milk", (L - 1) * f * prod);
        if (L >= 3) gain("wool", 2 * f * prod);
        if (fed < 2 * L) lines.push("🐄 Gia súc thiếu rau củ — sản lượng giảm một nửa.");
        break;
      }
      case "beehive": {
        flowersNear = g.buildings.filter((o) => (o.type === "flowers" || (o.type === "farm" && o.plot?.crop && CROPS[o.plot.crop.id]?.kind === "flower")) && Math.abs(o.x - b.x) <= 4 && Math.abs(o.y - b.y) <= 4).length;
        gain("honey", L * (1 + Math.min(1, flowersNear / 4)));
        if (rng.chance(0.05 * L + flowersNear * 0.01)) gain("royal_jelly", 1);
        break;
      }
      case "fishpond": {
        const pool = ["carp", "silver_salmon", season === 1 ? "sun_perch" : season === 2 ? "lantern_fish" : season === 3 ? "ice_trout" : "carp"];
        for (let i = 0; i < L + 1; i++) gain(rng.pick(pool), prod);
        if (g.weather === "storm" && rng.chance(0.5)) gain("thunder_eel", 1);
        break;
      }
      case "silkhouse": {
        const fed = eat(g, LEAVES, L);
        gain("silk_cocoon", L * (fed >= L ? 1 : 0.4) * prod);
        break;
      }
      case "market":
        gain("gold", population(g) * 3 * L * prod);
        break;
      case "clinic":
        gain("potion_hp", L * prod);
        break;
      case "tree":
        if (rng.chance(0.4)) gain("cactus_fruit", 1);
        break;
      default:
        break;
    }
  }

  // --- academy trains benched companions
  const academy = g.buildings.find((b) => b.type === "academy");
  if (academy) {
    const xp = Math.round(15 * academy.level * Math.max(1, g.maxFloor) * eff);
    const bench = Object.values(g.chars).filter((c) => !g.party.includes(c.id));
    for (const ch of bench) for (const m of giveXp(ch, xp)) lines.push(`🎓 ${m}`);
    if (bench.length) lines.push(`🎓 Học Viện huấn luyện ${bench.length} người ở nhà (+${xp} EXP).`);
  }

  // --- settlers arrive
  const free = housing(g) - (g.settlers + residents(g) + 1);
  if (fedBefore && free > 0) {
    const arrive = Math.min(free, 1 + Math.floor(appeal(g) / 15));
    g.settlers += arrive;
    lines.push(`👥 ${arrive} người dân mới dọn tới ${rankName(g)} (dân số ${population(g)}).`);
  } else if (!fedBefore && g.settlers > 0) {
    g.settlers--;
    lines.push("😟 Thiếu lương thực: một người dân đã bỏ đi.");
  }

  // --- next day
  g.day++;
  g.flags.tired = false;
  healParty(g);
  g.weather = rollWeather(g, g.day);
  if (isWet(g.weather)) for (const { plot } of allPlots(g)) plot.watered = true;
  const ready = allPlots(g).filter((p) => isReady(p.plot.crop)).length;
  if (ready) lines.push(`🌾 ${ready} ô đã chín, sẵn sàng thu hoạch.`);
  if (dry) lines.push(`🥀 ${dry} ô ruộng bị khô hôm qua (tưới nước để cây lớn đều và được mùa gấp rưỡi).`);
  if (grown === 0 && allPlots(g).length) lines.push("🌱 Ruộng đang trống — hãy gieo hạt!");
  if (eff < 1 && workersNeeded(g) > 0) lines.push(`👷 Thiếu công nhân: các công trình chỉ chạy ${Math.round(eff * 100)}% công suất.`);
  if (seasonOf(g.day) !== season) lines.unshift(`🍃 Chuyển mùa: bắt đầu mùa ${["Xuân", "Hạ", "Thu", "Đông"][seasonOf(g.day)]}!`);
  logMsg(g, "Một ngày mới ở Thánh Địa.");
  g.report = lines;
  return { lines, gains };
}

function feedSettlers(g: GameState, lines: string[]): boolean {
  if (g.settlers <= 0) return true;
  const need = Math.ceil(g.settlers / 4);
  const pantry = Object.keys(g.inventory)
    .map(getItem)
    .filter((it) => it.type === "crop" || it.type === "animal" || it.type === "food")
    .sort((a, b) => a.value - b.value)
    .map((it) => it.id);
  const got = eat(g, pantry, need);
  if (got < need) {
    lines.push(`🍞 Dân cần ${need} phần lương thực (nông sản, trứng, sữa, món ăn) mỗi ngày nhưng kho chỉ có ${got}.`);
    return false;
  }
  lines.push(`🍞 Dân chúng dùng ${need} phần lương thực.`);
  return true;
}

export function unlockedBiomeIds(g: GameState): string[] {
  const set = new Set<string>();
  for (let f = 1; f <= Math.max(1, g.maxFloor); f++) set.add(getFloor(f).biome);
  return [...set].filter((b) => BIOME_MATS[b]);
}

/** Growth info for UI. */
export function cropInfo(g: GameState, plot: PlotState, greenhouse = false) {
  const c = plot.crop;
  if (!c) return null;
  const def: CropDef = CROPS[c.id];
  const inSeason = greenhouse || def.seasons.includes(seasonOf(g.day));
  const left = Math.max(0, Math.ceil(cropTarget(c) - c.growth));
  return { def, ready: isReady(c), left, inSeason, stage: cropStage(c) };
}

export function heroPower(g: GameState) {
  return charStats(g.chars[g.heroId]).atk;
}
