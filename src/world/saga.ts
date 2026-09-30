import { LEVEL_STEP } from "../core/levels";
import { Rng } from "../core/rng";
import { T } from "../render/tiles";
import type { FloorDef } from "./floors";
import type { EntityKind, MapEntity, TownRect } from "./mapgen";

/**
 * The floor's great event: one whole district of the map given over to a multi-step objective.
 * Twenty events rotate between floors (never the same twice in a row). They are built on eight
 * kinds of play:
 *  clear   - beat the monster packs holding the district, then claim its heart
 *  nodes   - light / answer / win at every marker, then face what they were holding back
 *  blight  - smash the crystals feeding a spreading taint (walking inside it hurts)
 *  maze    - reach the middle of a maze cut into the land
 *  waves   - win several fights in a row at the heart
 *  collect - find the pieces scattered around the district and bring them to the heart
 *  hunt    - track down a roaming elite beast
 *  rescue  - find the lost people scattered around and send them home
 */
export type SagaMech = "clear" | "nodes" | "blight" | "maze" | "waves" | "collect" | "hunt" | "rescue";
/** How a marker of a "nodes" event is completed. */
export type NodeMode = "offer" | "battle" | "check" | "fire";
export interface SagaDef {
  id: string;
  mech: SagaMech;
  icon: string;
  title: (place: string) => string;
  intro: string;
  goal: string;
  done: string;
  core?: string; // sprite of the heart (prop, or "person:<look>")
  node?: string; // sprite of markers / pieces / lost people
  nodes?: number;
  mode?: NodeMode;
  decos?: string[];
  /** "nodes" events: a guardian fight after the last marker. */
  finale?: boolean;
  /** Blight tint colour. */
  tint?: string;
  /** Maze walls: rock cliffs or thorn hedges. */
  hedge?: boolean;
}

export const SAGAS: SagaDef[] = [
  { id: "siege", mech: "clear", icon: "⚔️", title: (p) => `Giải Phóng ${p}`, core: "tent", decos: ["crates", "banner", "bone_pile"],
    intro: "Một khu trại của người sống sót đã bị quái vật bao vây. Rào chắn đổ nát, lửa trại tắt lịm, và từ trong lều vọng ra tiếng kêu cứu yếu ớt.",
    goal: "Tiêu diệt các bầy quái đang vây trại, rồi giải cứu người bị giam trong lều.",
    done: "Những người sống sót ùa ra, ôm lấy nhau khóc. Họ gom tất cả những gì còn lại để cảm ơn bạn." },
  { id: "bandits", mech: "clear", icon: "🏴", title: (p) => `Sào Huyệt Thảo Khấu Ở ${p}`, core: "chest", decos: ["crates", "banner", "campfire_tent"],
    intro: "Những lá cờ đen cắm quanh một doanh trại tạm bợ. Bọn cướp đã chiếm nơi này làm sào huyệt, và kho đồ cướp được nằm ngay giữa trại — được canh gác cẩn mật.",
    goal: "Quét sạch các toán canh gác, rồi mở kho đồ ăn cướp.",
    done: "Kho đồ đầy ắp vàng bạc và hàng hoá của bao đoàn lữ hành. Giờ nó thuộc về bạn." },
  { id: "graveyard", mech: "clear", icon: "⚰️", title: (p) => `Nghĩa Địa Thức Giấc Ở ${p}`, core: "graves", decos: ["graves", "bone_pile", "lanterns"],
    intro: "Những nấm mộ bị bới tung. Người chết không chịu nằm yên, và giữa nghĩa địa là một hầm mộ cổ vẫn còn niêm phong.",
    goal: "Đánh bại những kẻ đã đội mồ sống dậy, rồi mở hầm mộ.",
    done: "Hầm mộ lặng im trở lại. Trong đó, đồ tuỳ táng của một dòng họ xưa vẫn còn nguyên." },
  { id: "ritual", mech: "nodes", icon: "🔮", title: (p) => `Phong Ấn Cổ Ở ${p}`, core: "rift", node: "altar", nodes: 4, mode: "offer", finale: true, decos: ["brazier"],
    intro: "Bốn tế đàn cổ đứng quanh một khe nứt đang rỉ ra thứ ánh sáng đục ngầu. Ai đó đã phong ấn một thứ gì dưới này, và phong ấn đang yếu dần.",
    goal: "Thắp sáng cả bốn tế đàn (dâng tinh thể hoặc vượt thử thách), rồi đối mặt với thứ nằm dưới phong ấn.",
    done: "Khe nứt khép lại. Thứ ánh sáng đục ngầu tan biến, chỉ còn lại những báu vật mà kẻ bị phong ấn từng canh giữ." },
  { id: "beacons", mech: "nodes", icon: "🔥", title: (p) => `Thắp Lại Tháp Lửa ${p}`, core: "brazier", node: "brazier", nodes: 4, mode: "fire", decos: ["banner"],
    intro: "Bốn ngọn tháp lửa từng soi đường cho lữ khách đã tắt ngấm. Không có ánh sáng, quái vật tràn về và người qua đường lạc lối.",
    goal: "Thắp lại cả bốn tháp lửa (cần củi hoặc chiến đấu với lũ quái quanh đó).",
    done: "Bốn cột lửa bùng lên cùng lúc, soi sáng cả vùng. Những lữ khách lạc đường tìm về và để lại quà cảm ơn." },
  { id: "bells", mech: "nodes", icon: "🔔", title: (p) => `Chuông Gió ${p}`, core: "bell", node: "bell", nodes: 4, mode: "check", decos: ["lanterns"],
    intro: "Bốn chiếc chuông treo trên cột đá, mỗi chiếc lệch một nhịp. Người ta nói khi cả bốn ngân cùng một giai điệu, cánh cửa ký ức sẽ mở.",
    goal: "Chỉnh lại cả bốn chiếc chuông (thử thách Trí tuệ, Ý chí, Nhanh nhẹn, Sức mạnh).",
    done: "Bốn tiếng chuông hoà làm một. Chiếc chuông lớn ở giữa ngân lên, và từ bên trong rơi ra những món đồ đã được cất giữ từ lâu." },
  { id: "festival", mech: "nodes", icon: "🎪", title: (p) => `Lễ Hội Giữa Vực ${p}`, core: "person:host", node: "tent", nodes: 3, mode: "check", decos: ["lanterns", "banner"],
    intro: "Giữa lòng Vực Sâu, một hội chợ rực rỡ đèn lồng. Người quản trò mời bạn thử tài ở ba gian trò chơi: may mắn, khéo léo và sức mạnh.",
    goal: "Thắng cả ba gian trò chơi, rồi nhận giải lớn từ người quản trò.",
    done: "“Nhà vô địch của lễ hội!” Người quản trò trao cho bạn giải thưởng lớn nhất trong đêm." },
  { id: "blight", mech: "blight", icon: "☣️", title: (p) => `Vết Nhơ Tại ${p}`, node: "rift", nodes: 3, tint: "110,30,140",
    intro: "Cả một vùng đất nhuốm màu tím bầm. Cây cỏ khô héo, không khí đặc quánh. Giữa vùng nhơ có những cột pha lê đang đập như tim.",
    goal: "Đập vỡ các cột pha lê nhơ bẩn để thanh tẩy vùng đất. Đi trong vùng nhơ sẽ bị rút máu dần.",
    done: "Cột pha lê cuối cùng vỡ tan. Màu tím rút đi như nước triều, cỏ xanh nhú lên dưới chân. Vùng đất để lại cho bạn những gì nó từng giấu." },
  { id: "miasma", mech: "blight", icon: "🫧", title: (p) => `Đầm Chướng Khí ${p}`, node: "poison_mist", nodes: 3, tint: "60,130,40",
    intro: "Một vùng trũng đầy chướng khí xanh lè. Ba mạch khí độc phun lên từ lòng đất, nuôi cả một đầm lầy chết chóc.",
    goal: "Bịt cả ba mạch khí độc (mỗi mạch có quái canh giữ). Ở lâu trong chướng khí sẽ mất máu.",
    done: "Mạch khí cuối cùng tắt lịm. Gió thổi tan màn sương độc, lộ ra những thứ bị chôn vùi trong đầm." },
  { id: "maze", mech: "maze", icon: "🌀", title: (p) => `Mê Cung ${p}`, core: "chest",
    intro: "Những bức tường đá dựng đứng thành một mê cung khổng lồ. Người ta đồn ở chính giữa có kho báu của kẻ đã xây nên nó.",
    goal: "Tìm đường vào tận trung tâm mê cung.",
    done: "Giữa mê cung là rương báu của kẻ kiến tạo, cùng một dòng chữ: “Cho kẻ đủ kiên nhẫn”." },
  { id: "hedge", mech: "maze", icon: "🌿", title: (p) => `Vườn Gai ${p}`, core: "whisper_tree", hedge: true,
    intro: "Một khu vườn bị bỏ hoang, bụi gai mọc thành những bức tường xanh rì uốn lượn. Ở giữa vườn có một cái cây cổ thụ đang toả sáng.",
    goal: "Lần theo lối đi giữa bụi gai để tới cây cổ thụ ở trung tâm.",
    done: "Cây cổ thụ rũ lá chào đón. Dưới gốc cây là những món quà mà người làm vườn năm xưa để lại." },
  { id: "arena", mech: "waves", icon: "🏟️", title: (p) => `Đấu Trường ${p}`, core: "person:gladiator", nodes: 3, decos: ["brazier", "banner"],
    intro: "Một đấu trường lộ thiên rực lửa đuốc. Người quản trò vỗ tay đôm đốp: “Kẻ thách đấu mới! Ba lượt, ba đối thủ, một phần thưởng xứng tầm!”",
    goal: "Thắng liền ba lượt đấu ở trung tâm đấu trường. Có thể nghỉ giữa các lượt.",
    done: "Khán đài vang dậy. Người quản trò trao cho bạn chiếc đai vô địch và cả túi tiền thưởng." },
  { id: "horde", mech: "waves", icon: "🛡️", title: (p) => `Tử Thủ ${p}`, core: "person:captain", nodes: 4, decos: ["crates", "banner"],
    intro: "Một đội lính nhỏ đang cố thủ sau chiến luỹ tạm bợ. “Chúng tới từng đợt một! Giúp chúng tôi giữ nơi này tới sáng!”",
    goal: "Đẩy lùi bốn đợt tấn công liên tiếp (nói chuyện với đội trưởng để bắt đầu mỗi đợt).",
    done: "Đợt tấn công cuối cùng tan vỡ. Đội trưởng chào bạn theo kiểu nhà binh và mở kho quân nhu." },
  { id: "relics", mech: "collect", icon: "💠", title: (p) => `Mảnh Vỡ Thánh Tích ${p}`, core: "altar", node: "ore_vein", nodes: 5,
    intro: "Một thánh tích cổ đã vỡ thành năm mảnh, văng khắp vùng. Bệ thờ ở giữa vẫn còn đó, chờ ngày được ghép lại.",
    goal: "Tìm cả năm mảnh thánh tích rải rác trong khu vực, rồi đặt chúng lên bệ thờ.",
    done: "Mảnh cuối cùng khớp vào. Thánh tích toả sáng rực rỡ và ban phước cho cả đội." },
  { id: "starflower", mech: "collect", icon: "🌠", title: (p) => `Mùa Hoa Sao ${p}`, core: "person:herbalist", node: "fireflies", nodes: 6,
    intro: "Một bà lang già ngồi bên gùi thuốc. “Mỗi năm chỉ một đêm, hoa sao nở khắp vùng này. Ta già rồi, không hái kịp... cháu giúp ta nhé?”",
    goal: "Hái sáu bông hoa sao mọc rải rác quanh vùng, mang về cho bà lang.",
    done: "Bà lang nâng niu từng bông hoa, rồi pha cho bạn một bình thuốc quý và tặng cả gùi đồ." },
  { id: "eggs", mech: "collect", icon: "🥚", title: (p) => `Trứng Lạc Tổ ${p}`, core: "nest", node: "nest", nodes: 4,
    intro: "Một cơn gió lớn đã hất tung tổ của một loài chim thần. Chim mẹ kêu thảm thiết trên tổ trống không.",
    goal: "Tìm bốn quả trứng lăn lạc khắp vùng, đưa về tổ.",
    done: "Chim mẹ ôm lấy từng quả trứng. Trước khi bay đi, nó thả xuống cho bạn một quả trứng lạ lấp lánh." },
  { id: "hunt", mech: "hunt", icon: "🐾", title: (p) => `Cuộc Săn Ở ${p}`, core: "campfire_tent",
    intro: "Những dấu chân khổng lồ in hằn trên đất, cây cối gãy đổ. Một con quái thú Tinh Anh đang lang thang khắp vùng này, và dân quanh đây đã treo thưởng cho cái đầu của nó.",
    goal: "Lần theo dấu vết, tìm và hạ gục con quái thú đang lang thang trong khu vực.",
    done: "Con quái thú gục xuống. Tin lan nhanh, và phần thưởng treo cho nó giờ là của bạn." },
  { id: "phantom", mech: "hunt", icon: "👻", title: (p) => `Bóng Ma ${p}`, core: "graves",
    intro: "Lữ khách kể về một bóng ma khổng lồ lượn lờ khắp vùng, ai chạm mặt đều mất hồn. Nó không đứng yên một chỗ nào.",
    goal: "Truy lùng và đánh bại bóng ma đang lang thang trong khu vực.",
    done: "Bóng ma tan thành khói, để lại những món đồ của các nạn nhân mà nó từng giữ lại." },
  { id: "travelers", mech: "rescue", icon: "🧭", title: (p) => `Đoàn Lữ Hành Lạc Lối ${p}`, core: "cart", node: "person:traveler", nodes: 4,
    intro: "Một chiếc xe hàng lật nghiêng bên đường. Đoàn lữ hành đã chạy tán loạn khi bị quái vật tấn công, giờ mỗi người lạc một nơi.",
    goal: "Tìm bốn người lữ hành lạc trong khu vực và chỉ đường cho họ về xe.",
    done: "Cả đoàn đã về đủ. Họ dựng lại xe hàng và chia cho bạn phần hậu hĩnh nhất." },
  { id: "children", mech: "rescue", icon: "🧒", title: (p) => `Lũ Trẻ Đi Lạc ${p}`, core: "person:mother", node: "person:child", nodes: 4,
    intro: "Một người mẹ hớt hải chạy tới: “Lũ trẻ trong làng chạy vào rừng chơi rồi không thấy về! Làm ơn giúp tôi tìm chúng!”",
    goal: "Tìm bốn đứa trẻ đang trốn khắp vùng và đưa chúng về với mẹ.",
    done: "Lũ trẻ ôm chầm lấy mẹ. Người mẹ khóc vì mừng và trao cho bạn những gì quý giá nhất mà cô có." },
];
export const SAGA = Object.fromEntries(SAGAS.map((s) => [s.id, s]));

export interface SagaInfo { id: string; name: string; x: number; y: number; r: number }

/** A 20-floor cycle, interleaved so two floors in a row never play the same way. */
const CYCLE = ["relics", "hunt", "travelers", "beacons", "bandits", "miasma", "festival", "horde", "starflower", "phantom", "hedge", "bells", "graveyard", "eggs", "children", "siege", "ritual", "blight", "maze", "arena"];
export function sagaFor(n: number): SagaDef {
  return SAGA[CYCLE[(n - 1) % CYCLE.length]];
}

interface Ctx {
  def: FloorDef;
  seed: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  centers: { x: number; y: number }[];
  start: { x: number; y: number };
  entities: MapEntity[];
  towns: TownRect[];
  occupied: Set<number>;
  passable: (x: number, y: number) => boolean;
  place: (e: Omit<MapEntity, "id" | "hx" | "hy">) => MapEntity;
}

/** Picks a district away from the portal, the lair and the villages, and builds the event there. */
export function placeSaga(c: Ctx): SagaInfo | undefined {
  const { def, w, h, tiles, entities, towns, occupied, passable, place } = c;
  const idx = (x: number, y: number) => y * w + x;
  const rng = new Rng(c.seed ^ 0x5a6a);
  const sd = sagaFor(def.n);
  const R = sd.mech === "maze" ? 10 : sd.mech === "collect" || sd.mech === "rescue" || sd.mech === "hunt" ? 11 : 8;
  const lair = entities.find((e) => e.kind === "guardian");
  const stairs = entities.find((e) => e.kind === "stairs");
  const inTown = (x: number, y: number, pad: number) => towns.some((t) => x >= t.x - pad && x < t.x + t.w + pad && y >= t.y - pad && y < t.y + t.h + pad);
  const score = (p: { x: number; y: number }) => {
    if (p.x - R < 3 || p.y - R < 3 || p.x + R > w - 4 || p.y + R > h - 4) return -1;
    if (inTown(p.x, p.y, Math.min(R, 8) + 2)) return -1;
    const d = (q?: { x: number; y: number }) => (q ? Math.hypot(q.x - p.x, q.y - p.y) : 99);
    const m = Math.min(d(c.start), d(lair), d(stairs));
    return m < Math.min(R, 8) + 8 ? -1 : m;
  };
  const best = c.centers.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0];
  if (!best) return;
  const { x: cx, y: cy } = best.p;
  const regionIdx = c.centers.indexOf(best.p);
  const place0 = def.regions[regionIdx % def.regions.length] ?? `Khu ${regionIdx + 1}`;

  const freeAt = (x: number, y: number) => x > 1 && y > 1 && x < w - 2 && y < h - 2 && passable(x, y) && !occupied.has(idx(x, y));
  const spotNear = (x: number, y: number, r = 2) => {
    for (let k = 0; k <= r; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (freeAt(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    return null;
  };
  // clear the heart of the district so the pieces have room
  const clearDisc = (r: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const i = idx(cx + x, cy + y);
      if (!occupied.has(i) && (tiles[i] === T.OBSTACLE || tiles[i] === T.WALL || tiles[i] === T.WATER)) tiles[i] = T.GROUND;
    }
  };
  const put = (kind: EntityKind, x: number, y: number, sprite: string, ref?: string, extra: Partial<MapEntity> = {}, r = 2) => {
    const p = spotNear(x, y, r);
    return p ? place({ kind, x: p.x, y: p.y, sprite, ref, saga: sd.id, ...extra }) : undefined;
  };
  const ring = (r: number, n: number, sprites: string[], gap = -1) => {
    for (let k = 0; k < n; k++) {
      if (k === gap || k === gap + 1) continue;
      const a = (k / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.8);
      if (freeAt(x, y)) place({ kind: "deco", x, y, sprite: sprites[k % sprites.length] });
    }
  };
  const lv = def.levelBase + 3 * LEVEL_STEP;
  const pack = () => [...rng.pick(def.groups), rng.pick(def.enemies)].slice(0, 4);
  /** Markers spread around the district (ring or scattered). */
  const scatter = (n: number, sprite: string, ringR: number | null) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (ringR ? -Math.PI / 2 : rng.range(0, 6.28));
      const rr = ringR ?? rng.range(4, R - 1);
      put("saga", Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * (ringR ? 1 : 0.8)), sprite, `node:${k}`, {}, 3);
    }
  };

  switch (sd.mech) {
    case "clear":
      clearDisc(5);
      put("saga", cx, cy, sd.core!, "core");
      for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put("monster", cx + dx, cy + dy, "", undefined, { group: pack(), level: lv, saga: "pack" });
      ring(7, 16, sd.decos ?? ["crates"], 4);
      break;
    case "nodes":
      clearDisc(6);
      put("saga", cx, cy, sd.core!, "core");
      scatter(sd.nodes ?? 4, sd.node!, 5);
      if (sd.decos) ring(8, 12, sd.decos, 9);
      break;
    case "blight":
      scatter(sd.nodes ?? 3, sd.node!, 4);
      break;
    case "waves":
      clearDisc(6);
      put("saga", cx, cy, sd.core!, "core");
      ring(6, 20, sd.decos ?? ["brazier"], 15);
      break;
    case "collect":
    case "rescue":
      clearDisc(3);
      put("saga", cx, cy, sd.core!, "core");
      scatter(sd.nodes ?? 4, sd.node!, null);
      break;
    case "hunt": {
      clearDisc(3);
      put("saga", cx, cy, sd.core!, "core");
      const a = rng.range(0, 6.28);
      put("monster", Math.round(cx + Math.cos(a) * 7), Math.round(cy + Math.sin(a) * 5), "", undefined, { group: pack(), level: lv + 2 * LEVEL_STEP, saga: "beast" }, 3);
      break;
    }
    case "maze": {
      // a perfect maze on odd cells inside a (2R+1) square, entered from the side facing the portal
      const S = R * 2 + 1;
      const x0 = cx - R, y0 = cy - R;
      const cell = (gx: number, gy: number) => idx(x0 + gx, y0 + gy);
      const WALL = T.WALL; // cliffs read clearly as maze walls (tall trees would hide the corridors)
      const keep = new Set<number>();
      for (let gy = 0; gy < S; gy++) for (let gx = 0; gx < S; gx++) {
        const i = cell(gx, gy);
        if (occupied.has(i)) keep.add(i);
        tiles[i] = WALL;
      }
      const seen = new Set<string>();
      const stack: [number, number][] = [[1, 1]];
      seen.add("1,1");
      tiles[cell(1, 1)] = T.GROUND;
      while (stack.length) {
        const [gx, gy] = stack[stack.length - 1];
        const nb = rng.shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]] as [number, number][]).filter(([dx, dy]) => gx + dx > 0 && gy + dy > 0 && gx + dx < S - 1 && gy + dy < S - 1 && !seen.has(`${gx + dx},${gy + dy}`));
        if (!nb.length) { stack.pop(); continue; }
        const [dx, dy] = nb[0];
        tiles[cell(gx + dx / 2, gy + dy / 2)] = T.GROUND;
        tiles[cell(gx + dx, gy + dy)] = T.GROUND;
        seen.add(`${gx + dx},${gy + dy}`);
        stack.push([gx + dx, gy + dy]);
      }
      for (const i of keep) {
        tiles[i] = T.GROUND;
        // something that stood on a wall corner gets a doorway into the maze
        const gx = (i % w) - x0, gy = Math.floor(i / w) - y0;
        if (gx % 2 === 0 && gy % 2 === 0) tiles[cell(gx + 1 < S - 1 ? gx + 1 : gx - 1, gy)] = T.GROUND;
      }
      // a few extra openings so it isn't a single long corridor
      for (let k = 0; k < 6; k++) { const gx = 2 * rng.int(1, R - 1), gy = 1 + 2 * rng.int(0, R - 1); tiles[cell(gx, gy)] = T.GROUND; }
      // the entrance faces the portal; dig out until open ground
      const sx = c.start.x < cx ? -1 : 1;
      const ey = R % 2 ? R : R - 1;
      let ex = sx < 0 ? 0 : S - 1;
      tiles[cell(ex, ey)] = T.GROUND;
      for (let k = 0; k < 40; k++) {
        ex += sx;
        const ax = x0 + ex, ay = y0 + ey;
        if (ax < 2 || ax > w - 3) break;
        if (passable(ax, ay)) break;
        tiles[idx(ax, ay)] = T.GROUND;
      }
      // the maze must never cut the floor in two: wherever open ground touches its rim, there is a gate
      for (let k = 1; k < S - 1; k += 2) {
        for (const [gx, gy, ox, oy] of [[k, 0, 0, -1], [k, S - 1, 0, 1], [0, k, -1, 0], [S - 1, k, 1, 0]] as const) {
          const outX = x0 + gx + ox, outY = y0 + gy + oy;
          if (passable(outX, outY)) tiles[cell(gx, gy)] = T.GROUND;
        }
      }
      const mid = R % 2 ? R : R - 1;
      tiles[cell(mid, mid)] = T.GROUND;
      place({ kind: "saga", x: x0 + mid, y: y0 + mid, sprite: sd.core!, ref: "core", saga: sd.id });
      let chests = 0;
      for (let tries = 0; tries < 200 && chests < 2; tries++) {
        const gx = 1 + 2 * rng.int(0, R - 1), gy = 1 + 2 * rng.int(0, R - 1);
        if (Math.abs(gx - mid) + Math.abs(gy - mid) < 6 || !freeAt(x0 + gx, y0 + gy)) continue;
        place({ kind: "chest", x: x0 + gx, y: y0 + gy, sprite: "chest" });
        chests++;
      }
      for (let k = 0; k < 3; k++) {
        const gx = 1 + 2 * rng.int(0, R - 1), gy = 1 + 2 * rng.int(0, R - 1);
        if (freeAt(x0 + gx, y0 + gy)) place({ kind: "monster", x: x0 + gx, y: y0 + gy, sprite: "", group: pack(), level: lv, saga: "pack" });
      }
      break;
    }
  }
  return { id: sd.id, name: sd.title(place0), x: cx, y: cy, r: R };
}
