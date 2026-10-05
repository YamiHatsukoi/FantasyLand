/**
 * Arena spells: 200 base spells for the 600 ordinary units (each in three variants, so every
 * unit's spell is its own) and 100 ultimates, one for each boss. A spell is a list of effects
 * written in a small language, one effect per "|":
 *
 *   dmg WHO P [x=N gap=S delay=S ls=F pierce type=p|m|t fx=bolt|beam|meteor|volley|ring|slash]
 *   dot WHO burn|poison|bleed P DUR        cc WHO stun|chill|silence|blind|weaken|shred|mark DUR
 *   heal WHO P [x=N gap=S]                 hpct WHO F            shield WHO P DUR
 *   buff WHO as|amp|armor|dodge|crit|vamp|ap|ad V DUR             stack ad|ap|armor|as|hp V
 *   dash WHO   blink WHO   knock WHO N   pull WHO   swap WHO      mana WHO V
 *   zone WHO R P DUR [slow=F heal]         chain WHO N P         multi N P
 *   summon N   revive F   cleanse WHO   taunt R DUR   stealth DUR   reflect F DUR
 *   steal WHO armor|ad|mana V   exec WHO F   hurt F   transform DUR [as=F amp=F vamp=F]
 *
 * WHO picks enemies: t (target), near, far, low (lowest health %), high (most health), carry
 * (most damage dealt), back (back row), rand, dense (most crowded), all, line (through the
 * target), me (the caster); a number picks several (rand3, low2); "@R" takes everything within R
 * hexes of the pick (t@1, me@2). With "a:" it picks allies: a:me, a:low2, a:carry, a:all, a:me@2.
 * P is in units of the unit's spell power (it grows with cost, stars and AP / AD).
 */
import type { Element } from "../combat/types";
import { hashString } from "../core/rng";
import { TUNE } from "./spellTune";
import type { Cost, Debuff, Role, SpellDef } from "./types";

// ------------------------------------------------------------ effect types
export interface Fx { k: string; w?: string; p?: number; n?: number; v?: number; dur?: number; r?: number; id?: string; o: Record<string, string> }

export function parseFx(src: string): Fx[] {
  return src.split("|").map((part) => {
    const toks = part.trim().split(/\s+/);
    const k = toks[0];
    const o: Record<string, string> = {};
    const pos: string[] = [];
    for (const t of toks.slice(1)) { const m = t.match(/^([a-z]+)=(.+)$/); if (m) o[m[1]] = m[2]; else if (/^[a-z]+$/.test(t) && ["pierce", "heal", "kill"].includes(t)) o[t] = "1"; else pos.push(t); }
    const num = (i: number) => Number(pos[i]);
    switch (k) {
      case "dmg": case "heal": return { k, w: pos[0], p: num(1), o };
      case "hpct": return { k, w: pos[0], v: num(1), o };
      case "dot": return { k, w: pos[0], id: pos[1], p: num(2), dur: num(3), o };
      case "cc": return { k, w: pos[0], id: pos[1], dur: num(2), o };
      case "shield": return { k, w: pos[0], p: num(1), dur: num(2), o };
      case "buff": return { k, w: pos[0], id: pos[1], v: num(2), dur: num(3), o };
      case "stack": return { k, id: pos[0], v: num(1), o };
      case "dash": case "blink": case "pull": case "swap": case "cleanse": return { k, w: pos[0], o };
      case "knock": return { k, w: pos[0], n: num(1), o };
      case "mana": return { k, w: pos[0], v: num(1), o };
      case "zone": return { k, w: pos[0], r: num(1), p: num(2), dur: num(3), o };
      case "chain": return { k, w: pos[0], n: num(1), p: num(2), o };
      case "multi": return { k, n: num(0), p: num(1), o };
      case "summon": return { k, n: num(0), o };
      case "revive": case "hurt": return { k, v: num(0), o };
      case "taunt": return { k, r: num(0), dur: num(1), o };
      case "stealth": return { k, dur: num(0), o };
      case "reflect": return { k, v: num(0), dur: num(1), o };
      case "steal": return { k, w: pos[0], id: pos[1], v: num(2), o };
      case "exec": return { k, w: pos[0], v: num(1), o };
      case "transform": return { k, dur: num(0), o };
      case "perm": return { k, id: pos[0], v: num(1), o };
      case "loot": return { k, id: pos[0], v: num(1), n: num(2), o };
      default: throw new Error(`unknown spell effect "${k}" in "${src}"`);
    }
  });
}

/** "passive:attack3 | ..." → the trigger and the effects. */
export function splitPassive(src: string): { passive?: string; fx: string } {
  const m = src.match(/^passive:([a-z]+\d*)\s*\|\s*(.*)$/);
  return m ? { passive: m[1], fx: m[2] } : { fx: src };
}
/** About how often a passive goes off in a fight. */
export function triggerCount(trig: string): number {
  const n = Number(trig.match(/\d+$/)?.[0] ?? 1);
  if (trig.startsWith("attack")) return 14 / n;
  if (trig.startsWith("second")) return 20 / n;
  if (trig.startsWith("struck")) return 25 / n;
  if (trig === "start") return 1;
  return 0.8; // kill, hurt50
}

/** A picker: base name, count, area radius, ally or not. */
export interface Who { ally: boolean; base: string; n: number; r: number }
export function parseWho(w: string): Who {
  const ally = w.startsWith("a:");
  const s = ally ? w.slice(2) : w;
  const m = s.match(/^([a-z]+?)(\d*)(?:@(\d+))?$/)!;
  return { ally, base: m[1], n: m[2] ? Number(m[2]) : 1, r: m[3] !== undefined ? Number(m[3]) : -1 };
}

// ------------------------------------------------------------ the 200 base spells
type Base = [id: string, name: string, icon: string, fx: string];
const TANK: Base[] = [
  ["t_stone", "Khiên Đá Tảng", "🛡️", "shield a:me 2.2 4 | taunt 2 2"],
  ["t_roar", "Gầm Thét Rung Trời", "🦁", "cc me@2 stun 1.25 | dmg me@2 0.5 fx=ring"],
  ["t_shell", "Mai Rùa Phản Kích", "🐢", "reflect 0.5 4 | buff a:me armor 40 4"],
  ["t_stomp", "Dậm Đất Chấn Động", "🦶", "dmg me@1 1 fx=ring | cc me@1 chill 3"],
  ["t_thorns", "Giáp Gai Tua Tủa", "🌵", "passive:struck5 | dmg me@1 0.6 fx=ring | dot me@1 bleed 0.3 3"],
  ["t_hook", "Móc Xích Kéo Hồn", "⛓️", "pull far | cc far stun 1 | dmg far 0.8 fx=beam"],
  ["t_iron", "Thân Thép Bất Hoại", "🗿", "buff a:me armor 60 5 | hpct a:me 0.15"],
  ["t_soul", "Hút Hồn Hộ Thể", "👻", "dmg me@1 0.7 ls=1 fx=ring"],
  ["t_guard", "Lá Chắn Đồng Đội", "🤝", "shield a:low2 1 4 | shield a:me 0.8 4"],
  ["t_ram", "Va Húc Như Trâu", "🐂", "dmg t 1.2 fx=slash | knock t 2 | cc t stun 1"],
  ["t_root", "Bám Rễ Cổ Thụ", "🌳", "heal a:me 1.2 | buff a:me armor 30 4 | cc me@1 chill 2"],
  ["t_halo", "Hào Quang Bảo Hộ", "✨", "passive:start | buff a:me@1 armor 35 30 | shield a:me@1 0.6 6"],
  ["t_duel", "Lời Thách Đấu", "📣", "taunt 3 3 | buff a:me dodge 0.3 3 | shield a:me 1 3"],
  ["t_quake", "Phản Chấn Ngược", "💢", "dmg me@1 0.8 fx=ring | cc me@1 weaken 4"],
  ["t_petrify", "Hóa Đá", "🪨", "shield a:me 2.8 2 | cc me@1 stun 0.75"],
  ["t_coil", "Vòi Quấn Siết", "🐙", "dmg t 1 fx=slash | cc t stun 1.75"],
  ["t_spines", "Gai Độc Hộ Thân", "🦔", "dot me@1 poison 0.8 4 | shield a:me 1 4"],
  ["t_hug", "Ôm Ghì Nghẹt Thở", "🫂", "cc t stun 2 | dmg t 0.6 fx=slash | heal a:me 0.6"],
  ["t_icewall", "Tường Băng", "🧊", "shield a:me@1 0.8 4 | cc me@1 chill 3"],
  ["t_shock", "Sóng Xung Kích", "🌊", "dmg line 0.9 fx=beam | knock line 1"],
  ["t_panic", "Rống Hoảng Loạn", "😱", "cc me@2 weaken 4 | cc me@2 blind 2"],
  ["t_tail", "Đuôi Quét Ngang", "🦎", "dmg me@1 1.1 fx=ring | knock me@1 1"],
  ["t_regen", "Cơ Thể Tái Sinh", "💚", "heal a:me 2 | cleanse a:me"],
  ["t_mirror", "Giáp Phản Thương", "🪞", "reflect 0.35 5 | shield a:me 0.8 5"],
  ["t_aegis", "Thánh Giáp Che Chở", "🛐", "shield a:all 0.45 4"],
  ["t_rockeat", "Ăn Thịt Lớn Mạnh", "🍖", "dmg t 1.4 type=t fx=slash | perm hp 0.03 kill"],
  ["t_mud", "Bãi Bùn Lầy", "🟫", "zone me 1 0.25 4 slow=0.35"],
  ["t_snare", "Cắm Rễ Giữ Chân", "🌱", "cc me@1 stun 1 | dmg me@1 0.5 fx=ring | heal a:me 0.6"],
  ["t_pack", "Gọi Bầy Hộ Giá", "🐾", "summon 1 | shield a:me 0.8 4"],
  ["t_gaze", "Ánh Mắt Hóa Đá", "👁️", "cc carry stun 1.5 | cc carry silence 3"],
  ["t_cocoon", "Kén Tơ Bọc Thân", "🕸️", "shield a:me 1.6 5 | mana a:me@1 15"],
  ["t_anchor", "Mỏ Neo Đáy Biển", "⚓", "pull t | dmg t 1 fx=slash | cc t chill 3"],
  ["t_saw", "Lưỡi Cưa Xoay Tròn", "🪚", "dmg me@1 0.35 x=3 gap=0.4 fx=ring"],
  ["t_heart", "Trái Tim Bất Khuất", "❤️", "passive:hurt50 | shield a:me 2 5 | buff a:me armor 40 5"],
  ["t_bodyguard", "Hộ Vệ Liều Mình", "🛡️", "shield a:carry 1.4 4 | taunt 2 2"],
];
const BRUTE: Base[] = [
  ["b_cleave", "Chém Bổ Đôi", "🪓", "dmg t 2 fx=slash | cc t shred 4"],
  ["b_maul", "Vồ Mồi Hút Máu", "🐺", "dmg t 1.6 ls=0.5 fx=slash"],
  ["b_whirl", "Xoáy Rìu", "🌀", "dmg me@1 1 fx=ring | buff a:me as 0.2 3"],
  ["b_blood", "Cuồng Huyết", "🩸", "buff a:me as 0.5 5 | buff a:me vamp 0.3 5"],
  ["b_punch", "Đấm Thủng Giáp", "👊", "dmg t 1.4 pierce fx=slash | knock t 1"],
  ["b_crush", "Nghiền Nát", "🔨", "dmg t 1.3 fx=slash | exec t 0.3 | loot gold 0.5 1 kill"],
  ["b_horn", "Húc Sừng Xuyên Trận", "🦏", "dmg line 1 fx=beam | cc line stun 0.75"],
  ["b_trample", "Giẫm Đạp", "🐘", "dmg me@1 0.9 fx=ring | cc me@1 stun 1"],
  ["b_claws", "Nanh Vuốt Liên Hoàn", "🐯", "dmg t 0.6 x=3 gap=0.25 fx=slash"],
  ["b_gnaw", "Gặm Xương Hút Hồn", "🦴", "dmg t 1.3 fx=slash | heal a:me 0.5 | perm ad 0.03 kill"],
  ["b_rift", "Bổ Đất Nứt Toác", "⛏️", "dmg line 1.1 fx=beam | dot line bleed 0.4 3"],
  ["b_rage", "Cơn Giận Tích Tụ", "😡", "passive:attack | stack as 0.04"],
  ["b_boulder", "Ném Tảng Đá", "🪨", "dmg far 1.5 fx=bolt | cc far stun 1"],
  ["b_rend", "Cắn Xé Thịt Da", "🦷", "dmg t 1.2 fx=slash | dot t bleed 0.8 4"],
  ["b_mace", "Vung Chùy Gai", "🏏", "dmg t@1 1 fx=ring | cc t@1 weaken 3"],
  ["b_crowd", "Lao Vào Đám Đông", "💥", "dash dense | dmg me@1 0.9 fx=ring"],
  ["b_sunder", "Phá Giáp Đánh Dấu", "🎯", "dmg t 1 fx=slash | cc t shred 6 | cc t mark 4"],
  ["b_bloodblade", "Huyết Kiếm Cuồng Bạo", "🗡️", "dmg t@1 0.7 ls=0.8 fx=ring"],
  ["b_ironhand", "Bàn Tay Sắt", "✊", "dmg t 1.5 fx=slash | cc t silence 3"],
  ["b_warcry", "Hiệu Lệnh Xung Trận", "🥁", "buff a:me@2 amp 0.2 4 | buff a:me as 0.3 4"],
  ["b_slap", "Tát Bay", "🖐️", "dmg t 1 fx=slash | knock t 3 | cc t stun 0.5"],
  ["b_reckless", "Đòn Liều Mạng", "💀", "dmg t 2.4 fx=slash | hurt 0.08"],
  ["b_pounce", "Vồ Ngã Kẻ Yếu", "🐆", "dash low | dmg low 1.4 fx=slash | cc low stun 1"],
  ["b_bladestorm", "Bão Kiếm", "⚔️", "dmg me@1 0.3 x=4 gap=0.3 fx=ring"],
  ["b_counter", "Bản Năng Sinh Tồn", "🥊", "passive:hurt50 | transform 5 as=0.5 amp=0.3 vamp=0.3"],
  ["b_tear", "Xé Xác", "🩻", "dmg t 1.1 fx=slash | exec t 0.2 | heal a:me 0.5"],
];
const ASSASSIN: Base[] = [
  ["a_backstab", "Ám Sát Sau Lưng", "🔪", "blink back | dmg back 2 fx=slash"],
  ["a_sneak", "Đâm Lén", "🗡️", "stealth 1.5 | buff a:me crit 0.3 4 | dmg t 1.4 fx=slash"],
  ["a_twin", "Song Đao Ba Nhịp", "⚔️", "passive:attack3 | dmg t 0.9 type=t fx=slash"],
  ["a_finish", "Kết Liễu", "☠️", "dmg low 1.4 fx=bolt | exec low 0.25 | loot roll 1 1 kill"],
  ["a_darts", "Phi Tiêu Tẩm Độc", "🎯", "dmg rand3 0.6 fx=bolt | dot rand3 poison 0.4 4"],
  ["a_dive", "Nhảy Chém Bổ Nhào", "🦅", "dash far | dmg far@1 1 fx=ring"],
  ["a_dance", "Vũ Điệu Lưỡi Dao", "💃", "dmg me@1 0.5 x=3 gap=0.2 fx=ring | buff a:me dodge 0.4 3"],
  ["a_hamstring", "Cắt Gân", "🩸", "dmg t 1 fx=slash | cc t chill 4 | dot t bleed 0.5 4"],
  ["a_ghost", "Bóng Ma Rình Rập", "🌫️", "passive:start | stealth 2.5 | buff a:me as 0.5 5 | buff a:me crit 0.3 5"],
  ["a_throat", "Móc Họng", "🪝", "dmg carry 1.5 fx=bolt | cc carry silence 3"],
  ["a_scythe", "Lưỡi Hái Tử Thần", "⚰️", "dmg t@1 0.9 type=t fx=ring | exec t@1 0.15"],
  ["a_heart", "Xuyên Tim", "💘", "dmg t 1.8 pierce fx=slash"],
  ["a_flash", "Nhát Chém Chớp Nhoáng", "⚡", "dash low | dmg low 1 fx=slash | dash rand | dmg rand 0.8 fx=slash"],
  ["a_ambush", "Mai Phục", "🕷️", "blink back | cc back stun 1.25 | dmg back 1 fx=slash"],
  ["a_venom", "Độc Thủ", "🐍", "dmg t 0.8 fx=slash | dot t poison 1 5 | cc t weaken 3"],
  ["a_leech", "Hút Sinh Lực", "🧛", "dmg t 1.3 ls=0.7 fx=slash"],
  ["a_clones", "Ảnh Kiếm Phân Thân", "👥", "multi 5 0.45"],
  ["a_snap", "Cú Đớp Chí Mạng", "🐊", "buff a:me crit 0.5 3 | dmg t 1.3 fx=slash"],
  ["a_windstep", "Lướt Gió", "🍃", "dash far | buff a:me as 0.4 4 | buff a:me dodge 0.3 4"],
  ["a_eyes", "Rạch Mắt", "👁️‍🗨️", "dmg t 1 fx=slash | cc t blind 3"],
  ["a_deepcut", "Vết Cắt Sâu", "🔻", "dmg t 0.9 fx=slash | dot t bleed 1.2 5"],
  ["a_bounty", "Săn Đầu Người", "💰", "dash high | dmg high 1.6 fx=slash | cc high mark 5 | loot gold 1 1 kill"],
  ["a_shadow", "Đòn Thù Bóng Tối", "🌑", "dmg t 1.2 fx=slash | cc t weaken 5 | stealth 1"],
  ["a_frenzy", "Cuồng Sát Liên Hoàn", "🔥", "passive:kill | stack ad 0.15 | stealth 1 | heal a:me 0.6"],
  ["a_storm", "Ám Khí Bão Táp", "🌪️", "dmg near3 0.7 fx=bolt"],
  ["a_behead", "Trảm Thủ Tích Huyết", "🪓", "dash low | dmg low 1.6 fx=slash | exec low 0.2 | perm ad 0.02 kill"],
  ["a_scorpion", "Nọc Bọ Cạp", "🦂", "dmg t 1 fx=slash | cc t stun 1 | dot t poison 0.6 3"],
  ["a_phase", "Thoắt Ẩn Thoắt Hiện", "🎭", "blink rand | dmg rand@1 0.8 fx=ring | stealth 1"],
  ["a_manabite", "Cắn Trộm Năng Lượng", "🔋", "dmg t 1.1 fx=slash | mana t -30 | mana a:me 20"],
  ["a_iceblade", "Lưỡi Băng Ám Sát", "❄️", "dmg t 1.2 fx=slash | cc t chill 3 | cc t shred 3"],
  ["a_acid", "Ăn Mòn Giáp", "🧪", "dmg t 0.8 fx=slash | steal t armor 20"],
  ["a_moon", "Sát Thủ Đêm Trăng", "🌙", "buff a:me vamp 0.35 4 | dmg t 1.2 fx=slash"],
  ["a_raid", "Đột Kích Tầm Xa", "🏹", "dash back | dmg back@1 0.9 fx=ring | cc back@1 chill 2"],
  ["a_hidden", "Mũi Tên Ẩn", "🎯", "dmg far 1.6 pierce fx=bolt"],
  ["a_windcut", "Chém Gió", "🌬️", "dmg line 1 fx=beam | buff a:me as 0.2 3"],
  ["a_flay", "Lột Da", "🐾", "dmg t 1 fx=slash | cc t shred 5 | cc t weaken 3"],
  ["a_rear", "Đánh Úp Hậu Phương", "🎒", "blink back | mana back@1 -25 | dmg back@1 0.7 fx=ring"],
  ["a_trap", "Cạm Bẫy Gai", "🪤", "zone t 1 0.3 3 | cc t stun 0.75"],
  ["a_combo", "Liên Hoàn Sát", "🔁", "dmg t 0.7 x=2 gap=0.2 fx=slash | dash low | dmg low 0.9 fx=slash"],
];
const MARKSMAN: Base[] = [
  ["m_pierce", "Bắn Xuyên Thấu", "🏹", "dmg line 1.1 pierce fx=beam"],
  ["m_rain", "Mưa Tên", "🌧️", "dmg t@1 0.4 x=3 gap=0.35 fx=volley"],
  ["m_poison", "Mũi Tên Tẩm Độc", "🐍", "dmg t 1.1 fx=bolt | dot t poison 0.8 4"],
  ["m_snipe", "Bắn Tỉa", "🔭", "dmg far 2 fx=bolt"],
  ["m_rapid", "Liên Thanh Phân Tán", "🔫", "passive:attack3 | dmg near2 0.6 fx=bolt"],
  ["m_firearrow", "Tên Lửa", "🔥", "dmg t@1 1 fx=bolt | dot t@1 burn 0.4 3"],
  ["m_feathers", "Lông Vũ Sắc Lẹm", "🪶", "dmg rand3 0.7 fx=bolt"],
  ["m_gale", "Tên Xé Gió", "💨", "dmg line 0.9 fx=beam | knock line 1"],
  ["m_weak", "Bắn Hạ Kẻ Yếu", "🎯", "dmg low 1.6 fx=bolt | exec low 0.15"],
  ["m_blind", "Tên Gây Mù", "🌫️", "dmg t 1 fx=bolt | cc t blind 3"],
  ["m_bounce", "Mũi Tên Nảy", "↩️", "chain t 4 0.6"],
  ["m_javelin", "Phóng Lao", "🔱", "dmg t 1.4 pierce fx=bolt | cc t chill 2"],
  ["m_push", "Bắn Đẩy Lùi", "🪝", "dmg t 1.1 fx=bolt | knock t 2"],
  ["m_focus", "Tập Trung Ngắm", "👁️", "buff a:me as 0.6 5 | buff a:me crit 0.2 5 | dmg t 0.8 fx=bolt"],
  ["m_spikes", "Gai Phóng", "🌵", "dmg near2 0.9 fx=bolt | dot near2 bleed 0.3 3"],
  ["m_frost", "Mũi Tên Băng", "🧊", "dmg t 1 fx=bolt | cc t chill 3 | cc t stun 0.5"],
  ["m_shred", "Tên Phá Giáp", "🛡️", "dmg t 0.9 fx=bolt | cc t shred 5 | cc t@1 shred 3"],
  ["m_shell", "Đạn Pháo", "💣", "dmg t@1 1.1 fx=meteor"],
  ["m_backline", "Bắn Vào Hậu Tuyến", "🎯", "dmg back 1.5 fx=bolt | cc back mark 4"],
  ["m_spit", "Phun Nọc", "🐸", "dmg t@1 0.6 fx=bolt | cc t@1 weaken 3"],
  ["m_retreat", "Bắn Lùi Né Tránh", "🏃", "dmg t 1.1 fx=bolt | buff a:me dodge 0.4 3"],
  ["m_soul", "Mũi Tên Hút Hồn", "👻", "dmg t 1.2 ls=0.6 fx=bolt"],
  ["m_silence", "Tên Câm Lặng", "🤐", "dmg carry 1 fx=bolt | cc carry silence 3"],
  ["m_storm", "Bão Lông Vũ", "🌪️", "dmg all 0.35 fx=volley"],
  ["m_charge", "Phi Đồng Xu Vàng", "🪙", "dmg t 1.3 fx=bolt | cc t stun 0.5 | loot gold 0.3 1"],
  ["m_divine", "Tên Thần Tích Lực", "🌟", "dmg t 1 fx=bolt | stack as 0.1"],
  ["m_ap", "Đạn Xuyên Giáp", "🔩", "dmg high 1.4 type=t fx=bolt"],
  ["m_thunder", "Tên Sét", "⚡", "chain t 3 0.7 | cc t stun 0.5"],
  ["m_net", "Lưới Bắt Mồi", "🕸️", "cc t@1 stun 1 | dmg t@1 0.5 fx=ring"],
  ["m_sling", "Phi Đá", "🪨", "dmg rand2 1 fx=bolt | cc rand2 stun 0.5"],
  ["m_tri", "Ba Mũi Tên", "🔱", "dmg near3 0.6 fx=bolt | buff a:me as 0.15 3"],
  ["m_mend", "Mũi Tên Hồi Phục", "💚", "dmg t 1 fx=bolt | heal a:low 0.7"],
  ["m_heavy", "Nỏ Hạng Nặng", "🏹", "dmg t 2.2 fx=bolt | buff a:me as -0.3 2"],
  ["m_mark", "Đánh Dấu Mục Tiêu", "📍", "cc t mark 6 | dmg t 0.9 fx=bolt | buff a:me@2 as 0.15 3"],
  ["m_hail", "Mưa Đá", "🌨️", "dmg t@2 0.45 fx=volley | cc t@2 chill 2"],
  ["m_spark", "Tia Lửa Bắn Lén", "🔥", "stealth 1 | dmg t 1.5 fx=bolt"],
  ["m_frag", "Đạn Nảy Phân Mảnh", "💥", "dmg t 1 fx=bolt | dmg t@1 0.5 delay=0.3 fx=ring"],
  ["m_endless", "Mũi Tên Ma Thuật", "♾️", "passive:attack | dmg t 0.12 type=t fx=bolt"],
  ["m_hawk", "Mắt Ưng", "🦅", "buff a:me crit 0.4 4 | dmg far 1.3 fx=bolt"],
];
const MAGE: Base[] = [
  ["g_fireball", "Cầu Lửa", "☄️", "dmg t@1 1 fx=bolt | dot t@1 burn 0.4 3"],
  ["g_lightning", "Tia Sét", "⚡", "chain t 5 0.55"],
  ["g_icicle", "Băng Trụ", "🧊", "dmg t 1.3 fx=bolt | cc t stun 1.25"],
  ["g_flurry", "Bão Tuyết Nhỏ", "🌨️", "zone t 1 0.35 4 slow=0.3"],
  ["g_void", "Tia Hư Không", "🌑", "dmg line 1.1 fx=beam | cc line weaken 3"],
  ["g_stars", "Mưa Sao Băng", "🌠", "dmg rand3 0.8 fx=meteor"],
  ["g_ring", "Vòng Lửa", "🔥", "dmg me@2 0.8 fx=ring | dot me@2 burn 0.3 3"],
  ["g_mute", "Phép Câm", "🤫", "dmg t@1 0.7 fx=ring | cc t@1 silence 2.5"],
  ["g_soul", "Hút Linh Hồn", "👻", "dmg t 1.2 fx=beam | heal a:me 0.8"],
  ["g_orb", "Tinh Cầu Bùng Nổ", "🔮", "dmg t 0.8 fx=bolt | dmg t@1 0.8 delay=0.6 fx=ring"],
  ["g_net", "Lưới Điện", "🕸️", "dmg t@1 0.7 fx=ring | cc t@1 stun 0.75"],
  ["g_swamp", "Đầm Độc", "☠️", "zone t 1 0.3 5 | dot t poison 0.5 4"],
  ["g_freeze", "Phép Đóng Băng", "❄️", "cc low stun 2 | dmg low 0.9 fx=bolt"],
  ["g_wave", "Sóng Thần", "🌊", "dmg line 0.9 fx=beam | knock line 2"],
  ["g_twister", "Lốc Xoáy", "🌪️", "dmg t@1 0.35 x=3 gap=0.3 fx=ring | cc t@1 chill 2"],
  ["g_curse", "Lời Nguyền", "🕯️", "cc t@1 weaken 5 | cc t@1 mark 5 | dmg t@1 0.4 fx=ring"],
  ["g_burn", "Đốt Ma Lực", "🔷", "mana t@1 -30 | dmg t@1 0.8 fx=ring"],
  ["g_meteor", "Thiên Thạch Nhỏ", "☄️", "dmg t@1 1.2 delay=0.5 fx=meteor | cc t stun 0.75"],
  ["g_purge", "Ánh Sáng Thanh Tẩy", "☀️", "dmg t@1 0.9 fx=ring | cc t@1 blind 2"],
  ["g_spikes", "Gai Đá Trồi Lên", "🗻", "dmg line 1 fx=beam | cc line stun 0.5"],
  ["g_drain", "Phép Hút Năng Lượng", "🔋", "mana t -40 | mana a:me 40 | dmg t 0.8 fx=beam"],
  ["g_bounce", "Quả Cầu Nảy", "🔵", "chain t 6 0.45"],
  ["g_gravity", "Hố Trọng Lực", "🌀", "pull t@2 | dmg t@1 0.8 fx=ring"],
  ["g_acid", "Mưa Axit", "🧪", "dmg t@2 0.5 fx=volley | cc t@2 shred 4"],
  ["g_death", "Tia Chết Chóc", "💀", "dmg low 1.2 type=t fx=beam | exec low 0.2"],
  ["g_bomb", "Bom Hẹn Giờ", "💣", "dmg t@1 1.6 delay=1.5 fx=meteor"],
  ["g_crystal", "Tinh Thể Hộ Mệnh", "💎", "shield a:me 1 4 | dmg t 1 fx=bolt"],
  ["g_mirror", "Phép Gương Phản Hồi", "🪞", "passive:struck4 | reflect 0.4 2 | dmg carry 0.8 fx=beam"],
  ["g_dragon", "Hỏa Long Quyển", "🐉", "dmg line 0.8 fx=beam | dot line burn 0.6 4"],
  ["g_chaos", "Ma Pháp Hỗn Loạn", "🎲", "multi 4 0.55 | loot roll 0.25 1"],
  ["g_moon", "Nguyệt Quang", "🌙", "dmg t@1 0.8 fx=ring | heal a:me@1 0.4"],
  ["g_maze", "Mê Cung Ảo Ảnh", "🌀", "cc me@2 blind 2.5 | cc me@2 chill 2 | stealth 1 | dmg me@2 0.6 fx=ring"],
  ["g_soulfire", "Ác Hồn Tích Lũy", "🔥", "dmg low 1.5 fx=bolt | perm ap 3 kill"],
  ["g_spear", "Mũi Giáo Ánh Sáng", "✨", "dmg line 1.2 pierce fx=beam"],
  ["g_runes", "Lửa Tím Cổ Ngữ", "🟣", "dmg t@1 0.9 fx=ring | cc t silence 2 | loot xp 0.3 2"],
];
const SUPPORT: Base[] = [
  ["s_spring", "Suối Nguồn Chữa Lành", "⛲", "heal a:low2 1"],
  ["s_charm", "Bùa Hộ Mệnh", "🧿", "shield a:low2 0.9 4"],
  ["s_song", "Bài Ca Chiến Trận", "🎵", "buff a:me@2 as 0.3 4 | shield a:me@2 0.5 4"],
  ["s_rain", "Mưa Phép Hồi Sinh", "🌧️", "heal a:all 0.4"],
  ["s_pollen", "Phấn Hoa Thanh Tẩy", "🌸", "cleanse a:all | heal a:low 0.6"],
  ["s_light", "Lá Chắn Ánh Sáng", "💠", "shield a:me@1 0.7 4 | cc me@1 blind 2"],
  ["s_infuse", "Tiếp Năng Lượng", "🔋", "mana a:carry 40 | buff a:carry ap 15 4 | shield a:carry 0.8 4"],
  ["s_angel", "Vòng Tay Thiên Thần", "👼", "heal a:low 1.4 | shield a:low 0.5 3"],
  ["s_bind", "Trói Buộc", "🔗", "cc t@1 stun 1 | heal a:low 0.6"],
  ["s_lullaby", "Lời Ru Ngủ", "😴", "cc carry stun 2 | cc carry weaken 3"],
  ["s_breeze", "Gió Lành Che Chở", "🍃", "passive:start | buff a:all dodge 0.15 30 | shield a:all 0.5 8"],
  ["s_drums", "Trống Trận", "🥁", "buff a:all amp 0.15 4 | heal a:all 0.3"],
  ["s_spores", "Bào Tử Hồi Máu", "🍄", "zone me 1 0.35 5 heal"],
  ["s_holy", "Giáp Thánh", "⛪", "buff a:low2 armor 40 5 | heal a:low2 0.5"],
  ["s_bless", "Chúc Phúc Ma Lực", "🔮", "mana a:me@2 20 | heal a:me@2 0.3 | loot xp 0.25 1"],
  ["s_share", "Hút Máu Chia Sẻ", "🩸", "dmg t 0.9 fx=beam | heal a:low2 0.6"],
  ["s_slow", "Phép Chậm", "🐌", "cc t@2 chill 4 | dmg t@2 0.3 fx=ring"],
  ["s_seal", "Ấn Bảo Hộ", "🔰", "shield a:carry 1.5 5 | buff a:carry vamp 0.2 5"],
  ["s_fireflies", "Bầy Đom Đóm", "✨", "passive:second3 | heal a:low 0.5"],
  ["s_hypno", "Ánh Mắt Thôi Miên", "🌀", "cc high stun 1.5 | mana high -30 | dmg high 0.7 fx=beam"],
  ["s_elixir", "Thần Dược", "🧪", "hpct a:low 0.25"],
  ["s_prayer", "Lời Cầu Nguyện", "🙏", "heal a:all 0.25 | shield a:all 0.25 3"],
  ["s_scent", "Hương Thơm Hưng Phấn", "🌺", "buff a:me@2 as 0.2 4 | buff a:me@2 crit 0.15 4 | heal a:me@2 0.4"],
  ["s_hex", "Lá Bùa Suy Nhược", "📜", "cc t@1 weaken 5 | cc t@1 shred 5 | dmg t@1 0.6 fx=ring"],
  ["s_spring2", "Hồi Xuân", "🌿", "heal a:low 0.8 | buff a:low vamp 0.2 5"],
  ["s_ward", "Kết Giới", "🔯", "zone me 1 0.25 4 | shield a:me@1 0.5 4"],
];
export const BASE_SPELLS: Record<Role, Base[]> = { tank: TANK, brute: BRUTE, assassin: ASSASSIN, marksman: MARKSMAN, mage: MAGE, support: SUPPORT };

// ------------------------------------------------------------ the 100 ultimates
/** [id, name, icon, m (melee) | r (ranged) | a (any), effects] */
type Ult = [id: string, name: string, icon: string, fit: "m" | "r" | "a", fx: string];
export const ULTIMATES: Ult[] = [
  ["u_meteors", "Mưa Thiên Thạch", "☄️", "a", "dmg rand4@1 0.8 fx=meteor | cc rand4@1 stun 0.75"],
  ["u_doom", "Đại Tận Thế", "🌋", "a", "dmg all 0.9 fx=ring | dot all burn 0.4 4"],
  ["u_devour", "Nuốt Chửng Linh Hồn", "👹", "m", "dmg low 2.5 fx=slash | exec low 0.35 | hpct a:me 0.3 | perm hp 0.05 kill"],
  ["u_horde", "Triệu Hồi Bầy Đàn", "🐺", "a", "summon 3"],
  ["u_blackhole", "Hố Đen Nuốt Trời", "🕳️", "a", "pull dense@2 | dmg dense@1 1 fx=ring | cc dense@1 stun 2"],
  ["u_chains", "Xích Lôi Liên Hoàn", "⛓️", "r", "chain t 9 0.6 | cc t stun 1"],
  ["u_rebirth", "Hồi Sinh Đồng Loại", "💫", "a", "revive 0.7 | heal a:all 0.5"],
  ["u_timestop", "Ngưng Đọng Thời Gian", "⏳", "a", "cc all stun 1.75 | dmg all 0.4 fx=ring"],
  ["u_beast", "Hóa Cuồng Thú", "🐲", "m", "transform 7 as=1 amp=0.4 vamp=0.3"],
  ["u_prison", "Ngục Tù Vĩnh Cửu", "🧊", "a", "cc t@2 stun 2.5 | dmg t@2 0.7 fx=ring"],
  ["u_miasma", "Mây Tử Thần", "☁️", "r", "zone t 2 0.45 6 | cc t@2 weaken 4"],
  ["u_drain", "Hút Cạn Sinh Khí", "🩸", "a", "dmg all 0.6 ls=1 fx=beam"],
  ["u_aegis", "Thánh Thuẫn Bất Diệt", "🛡️", "a", "shield a:all 1 5 | cleanse a:all"],
  ["u_stampede", "Cuồng Bạo Xung Phong", "🦏", "m", "dmg line 1.6 fx=beam | cc line stun 1.25 | dash t"],
  ["u_mirror", "Gương Phản Chiếu", "🪞", "m", "reflect 0.8 6 | buff a:me armor 60 6 | shield a:me 1.5 6 | taunt 3 3"],
  ["u_volley", "Mưa Tên Hủy Diệt", "🏹", "r", "dmg t@2 0.5 x=4 gap=0.4 fx=volley"],
  ["u_manafire", "Thiêu Rụi Ma Lực", "🔥", "a", "mana all -50 | dmg all 0.7 fx=ring | cc all silence 2"],
  ["u_quake", "Động Đất Diệt Thế", "🌍", "m", "dmg me@2 1.4 fx=ring | cc me@2 stun 2"],
  ["u_swap", "Hoán Đổi Linh Hồn", "🔄", "m", "swap back | dmg me@1 1.2 fx=ring | cc back stun 2"],
  ["u_tempest", "Bão Tố Tận Diệt", "🌪️", "r", "zone all 9 0.25 6 slow=0.35"],
  ["u_roar", "Long Hống", "🐉", "a", "dmg line 1.8 fx=beam | dot line burn 0.8 4 | knock line 2"],
  ["u_verdict", "Phán Quyết Thiên Đường", "⚖️", "a", "dmg high 3 fx=meteor | exec all 0.12"],
  ["u_deathdance", "Vũ Điệu Tử Thần", "💀", "m", "dash low | dmg low 1.2 fx=slash | dash low | dmg low 1.2 fx=slash | dash low | dmg low 1.2 fx=slash"],
  ["u_bats", "Bầy Dơi Huyết Nguyệt", "🦇", "a", "multi 10 0.35 | heal a:me 1"],
  ["u_thunder", "Thần Sấm Giáng Thế", "⚡", "r", "dmg rand5 0.9 fx=meteor | cc rand5 stun 1"],
  ["u_iceage", "Kỷ Băng Hà", "❄️", "a", "cc all chill 5 | dmg all 0.6 fx=ring | cc all shred 4"],
  ["u_thornwood", "Rừng Gai Trói Buộc", "🌿", "a", "cc all stun 1.25 | dot all bleed 0.6 4"],
  ["u_inferno", "Hỏa Ngục Bùng Cháy", "🔥", "a", "zone me 2 0.6 6 | buff a:me armor 40 6"],
  ["u_flood", "Thủy Triều Nhấn Chìm", "🌊", "a", "dmg all 0.7 fx=ring | knock all 1 | cc all chill 3"],
  ["u_sanctify", "Thánh Quang Phục Sinh", "✨", "a", "heal a:all 1.2 | cleanse a:all | buff a:all armor 30 4"],
  ["u_abyss", "Lời Nguyền Vực Thẳm", "🌑", "a", "cc all weaken 6 | cc all mark 6 | dmg all 0.4 fx=ring"],
  ["u_mountain", "Cơn Thịnh Nộ Của Núi", "⛰️", "m", "shield a:me 2.5 6 | dmg me@2 1 fx=ring | taunt 3 4"],
  ["u_swords", "Ngàn Kiếm Quy Tông", "🗡️", "r", "multi 12 0.32"],
  ["u_dragonguard", "Thần Long Hộ Thể", "🐉", "m", "transform 8 as=0.5 amp=0.3 vamp=0.2 | shield a:me 1.5 8"],
  ["u_eye", "Mắt Bão", "🌀", "a", "pull all | dmg me@2 1.2 fx=ring"],
  ["u_daggers", "Đoạt Mệnh Phi Đao", "🔪", "m", "blink back | dmg back@1 1.4 fx=ring | exec back@1 0.25"],
  ["u_heavennet", "Thiên La Địa Võng", "🕸️", "a", "cc all stun 1 | cc all chill 4 | dmg all 0.5 fx=ring"],
  ["u_exorcism", "Diệt Ma Chú", "📿", "a", "cc carry2 silence 5 | dmg carry2 1.6 fx=beam"],
  ["u_hydra", "Cửu Đầu Xà Phun Độc", "🐍", "r", "dmg rand9 0.4 fx=bolt | dot rand9 poison 0.5 5"],
  ["u_lotus", "Hồng Liên Hỏa", "🌺", "r", "dmg t@1 1 x=3 gap=0.5 fx=meteor"],
  ["u_phantasm", "Ma Kính Hư Ảo", "🔮", "a", "stealth 2 | multi 6 0.5 | heal a:me 0.8"],
  ["u_undying", "Trái Tim Bất Diệt", "💗", "m", "hpct a:me 0.5 | buff a:me vamp 0.5 6 | taunt 2 3"],
  ["u_darkbreath", "Hắc Long Tức", "🐲", "r", "dmg line 2 fx=beam | cc line weaken 4"],
  ["u_dominion", "Vương Quyền Áp Chế", "👑", "a", "cc all stun 1 | buff a:all amp 0.25 5 | dmg all 0.5 fx=ring"],
  ["u_angel", "Thiên Thần Giáng Lâm", "👼", "a", "revive 1 | shield a:all 0.6 4"],
  ["u_sandstorm", "Bão Cát Sa Mạc", "🏜️", "a", "zone all 9 0.2 6 | cc all blind 4"],
  ["u_coffin", "Băng Phong Quan Tài", "⚰️", "a", "cc high2 stun 3.5 | dmg high2 1.2 fx=bolt"],
  ["u_myriad", "Lôi Đình Vạn Quân", "🌩️", "r", "chain t 12 0.5"],
  ["u_skysplit", "Phá Thiên Trảm", "⚔️", "m", "dmg line 2.5 pierce fx=beam"],
  ["u_voidmaw", "Hư Không Nuốt Chửng", "🕳️", "a", "dmg low2 2 type=t fx=ring | exec low2 0.3 | perm ap 5 kill"],
  ["u_altar", "Tế Đàn Máu", "🩸", "a", "hurt 0.2 | buff a:all amp 0.35 6 | buff a:all vamp 0.2 6"],
  ["u_gale", "Cuồng Phong Xé Trời", "💨", "r", "dmg all 0.6 fx=ring | knock all 2 | cc all chill 2"],
  ["u_yinyang", "Địa Ngục Băng Hỏa", "☯️", "a", "dmg t@2 0.8 fx=ring | dot t@2 burn 0.5 4 | cc t@2 chill 4"],
  ["u_bones", "Đạo Quân Xương Trắng", "💀", "a", "summon 2 | buff a:all as 0.25 5"],
  ["u_blacksun", "Mặt Trời Đen", "⚫", "a", "zone t 2 0.7 5 | cc t@2 silence 3"],
  ["u_whale", "Kình Ngư Vẫy Đuôi", "🐋", "m", "dmg me@2 1.1 fx=ring | knock me@2 3 | cc me@2 stun 1"],
  ["u_starfall", "Mưa Ánh Sao", "🌟", "r", "dmg rand6 0.7 fx=meteor | heal a:all 0.3"],
  ["u_split", "Linh Hồn Phân Liệt", "👥", "a", "summon 2 | stealth 1.5"],
  ["u_seal", "Phong Ấn Cổ Đại", "📜", "a", "cc carry stun 4 | cc carry silence 6 | cc carry2 weaken 5"],
  ["u_cosmos", "Hút Năng Lượng Vũ Trụ", "🌌", "a", "mana all -30 | mana a:all 25 | dmg all 0.4 fx=ring | loot xp 0.5 2"],
  ["u_lighthouse", "Tháp Canh Ánh Sáng", "🗼", "r", "dmg t 0.5 x=10 gap=0.25 fx=beam"],
  ["u_antler", "Sừng Thần Xuyên Núi", "🦌", "m", "dash far | dmg line 1.6 fx=beam | cc line stun 1"],
  ["u_venoms", "Vạn Độc Quy Tông", "☠️", "a", "dot all poison 1.4 6 | cc all weaken 4"],
  ["u_wall", "Bức Tường Thép", "🧱", "m", "shield a:all 0.8 6 | taunt 4 4 | buff a:me armor 80 6"],
  ["u_godspear", "Ngọn Giáo Thần Linh", "🔱", "r", "dmg far 3 pierce fx=beam | knock far 2"],
  ["u_bloodrain", "Cơn Mưa Máu", "🌧️", "a", "dmg all 0.5 ls=0.6 fx=volley | dot all bleed 0.5 4"],
  ["u_sonic", "Sóng Âm Hủy Diệt", "📢", "a", "dmg me@3 1 fx=ring | cc me@3 silence 3 | cc me@3 stun 0.75"],
  ["u_immortal", "Hóa Thân Bất Tử", "♾️", "m", "revive 0.5 | hpct a:me 0.4 | buff a:me armor 50 5"],
  ["u_citadel", "Liệt Hỏa Thiêu Thành", "🏯", "r", "dmg t@2 0.6 x=3 gap=0.6 fx=meteor"],
  ["u_illusion", "Huyễn Thuật Mê Hồn", "🌀", "a", "swap carry | cc all blind 3 | cc me@2 stun 1.5 | dmg me@2 0.8 fx=ring"],
  ["u_earthwake", "Đại Địa Thức Tỉnh", "🌋", "m", "dmg me@2 0.6 x=3 gap=0.5 fx=ring | cc me@2 stun 0.75"],
  ["u_glacier", "Băng Hà Tràn Về", "🏔️", "a", "zone all 9 0.3 5 slow=0.45 | cc rand3 stun 1.5"],
  ["u_seaking", "Long Vương Nộ", "🐉", "a", "dmg all 1 fx=ring | cc all shred 5"],
  ["u_witch", "Phù Thủy Hắc Ám", "🧙", "r", "dmg low3 1.2 fx=beam | cc low3 silence 3"],
  ["u_call", "Tiếng Gọi Bầy Đàn", "📯", "a", "summon 2 | buff a:all amp 0.2 5 | heal a:all 0.3"],
  ["u_rift", "Chém Rách Không Gian", "🌌", "m", "blink far | dmg far@2 1.2 fx=ring | cc far@2 chill 3"],
  ["u_needles", "Mưa Kim Châm", "📍", "r", "multi 15 0.25 | cc t mark 5"],
  ["u_guardian", "Thần Hộ Mệnh", "🛐", "a", "shield a:low3 1.5 6 | heal a:low3 0.8"],
  ["u_kingblade", "Thanh Kiếm Của Vua", "👑", "m", "dmg t 3 fx=slash | exec t 0.3 | buff a:me as 0.5 5 | loot gold 1 2 kill"],
  ["u_hellgate", "Cổng Địa Ngục", "🔥", "a", "summon 2 | zone dense 2 0.35 5"],
  ["u_vortex", "Lốc Xoáy Hút Hồn", "🌪️", "a", "pull dense@3 | dmg dense@2 0.9 fx=ring | mana dense@2 -30"],
  ["u_rite", "Vòng Tròn Tế Lễ", "🔯", "a", "dmg me@2 0.9 fx=ring | heal a:me@2 0.9"],
  ["u_eagle", "Thần Ưng Săn Mồi", "🦅", "r", "dmg back 1.5 x=2 gap=0.3 fx=bolt | cc back stun 1.5"],
  ["u_worldtree", "Rễ Cây Thế Giới", "🌳", "a", "cc all stun 1.5 | heal a:all 0.5"],
  ["u_firesea", "Biển Lửa", "🔥", "a", "zone all 9 0.35 5 | dot all burn 0.4 5"],
  ["u_deathmark", "Ấn Ký Tử Vong", "☠️", "a", "cc all mark 8 | dmg low 2 fx=beam | exec all 0.1"],
  ["u_holymirror", "Lá Chắn Phản Chiếu Thần Thánh", "✨", "a", "reflect 0.5 5 | shield a:me@2 1 5"],
  ["u_pillar", "Kình Thiên Trụ", "🗿", "m", "dmg me@1 2 fx=ring | knock me@1 3 | cc me@1 stun 2"],
  ["u_demongod", "Ma Thần Thức Tỉnh", "👿", "a", "transform 6 as=0.6 amp=0.6 | stack ad 0.15 | stack ap 30"],
  ["u_torrent", "Thác Lũ", "🌊", "r", "dmg line 1.2 x=2 gap=0.5 fx=beam | knock line 2"],
  ["u_twindragons", "Song Long Tranh Châu", "🐉", "r", "chain t 6 0.8 | chain far 6 0.8"],
  ["u_phoenix", "Phượng Hoàng Tái Sinh", "🦅", "a", "revive 1 | revive 0.6 | dmg all 0.4 fx=ring | dot all burn 0.5 3"],
  ["u_night", "Màn Đêm Vĩnh Cửu", "🌑", "a", "cc all blind 4 | stealth 2 | buff a:all amp 0.3 5 | dmg all 0.5 fx=ring"],
  ["u_voidslash", "Hư Không Trảm", "⚫", "m", "blink low | dmg low 2 fx=slash | blink low | dmg low 2 fx=slash"],
  ["u_judgement", "Ánh Sáng Phán Xét", "☀️", "r", "dmg t@1 2 fx=meteor | cc all blind 2"],
  ["u_cyclone", "Cuồng Long Bạo Phong", "🌪️", "m", "dmg me@2 0.5 x=5 gap=0.3 fx=ring | buff a:me dodge 0.5 2"],
  ["u_icedragon", "Băng Long Phong Ấn", "🐲", "a", "cc high stun 4 | dmg all 0.6 fx=ring | cc all chill 4"],
  ["u_reaper", "Lưỡi Hái Linh Hồn", "🌙", "m", "dmg me@2 1.2 fx=ring | exec me@2 0.2 | heal a:me 1"],
  ["u_array", "Đại Pháp Trận", "🔮", "r", "zone t 2 0.5 4 | zone a:me 1 0.3 4 heal | mana a:all 25"],
  ["u_sacrifice", "Thiên Địa Đồng Thọ", "💥", "a", "hurt 0.3 | dmg all 1.6 fx=meteor | cc all stun 1"],
];

// ------------------------------------------------------------ balance
/** How many units a picker is worth, roughly (areas are rarely full). */
function worth(w: string): number {
  const p = parseWho(w);
  const n = Math.min(4, p.n);
  if (p.ally) {
    if (p.base === "all") return 3.5;
    if (p.base === "me" && p.r >= 0) return [1, 1.6, 2.3, 2.8][Math.min(3, p.r)];
    return n;
  }
  if (p.base === "all") return 3.5;
  if (p.base === "line") return 1.8;
  if (p.r >= 0) return n * [1, 1.6, 2.4, 3][Math.min(3, p.r)];
  return n;
}
const CC_VAL: Record<string, number> = { stun: 0.45, silence: 0.2, chill: 0.07, blind: 0.1, weaken: 0.08, shred: 0.07, mark: 0.07 };
const BUFF_VAL: Record<string, (v: number) => number> = {
  as: (v) => v * 0.25, amp: (v) => v * 0.35, armor: (v) => (v / 100) * 0.2, dodge: (v) => v * 0.25, crit: (v) => v * 0.2, vamp: (v) => v * 0.3,
};

/** A spell's rough value in single-target spell hits, split into what scales with power and what does not. */
export function spellValue(fx: Fx[]): { scal: number; flat: number } {
  let scal = 0, flat = 0;
  for (const e of fx) {
    const n = e.w ? worth(e.w) : 1;
    const x = Number(e.o.x ?? 1);
    switch (e.k) {
      case "dmg": scal += e.p! * n * x * (1 + (e.o.ls ? Number(e.o.ls) * 0.3 : 0) + (e.o.pierce ? 0.15 : 0)); break;
      case "dot": scal += e.p! * n * 0.85; break;
      case "heal": scal += e.p! * n * x * 0.7; break;
      case "shield": scal += e.p! * n * 0.6; break;
      case "zone": scal += e.p! * e.dur! * (e.w === "all" ? 3.5 : [1, 1.6, 2.4, 3][Math.min(3, e.r!)]) * 0.6; flat += e.o.slow ? 0.1 * e.dur! : 0; break;
      case "chain": scal += e.p! * e.n! * 0.85; break;
      case "multi": scal += e.p! * e.n!; break;
      case "hpct": flat += e.v! * 3 * n; break;
      case "cc": flat += (CC_VAL[e.id!] ?? 0.1) * e.dur! * n; break;
      case "buff": flat += e.id === "ap" ? (e.v! / 100) * 1.5 * n : e.id === "ad" ? e.v! * 1.5 * n : (BUFF_VAL[e.id!]?.(e.v!) ?? 0) * e.dur! * n; break;
      case "stack": flat += 0.25; break;
      case "dash": case "blink": case "swap": flat += 0.15; break;
      case "knock": case "pull": flat += 0.12 * Math.min(3, n); break;
      case "mana": flat += (Math.abs(e.v!) / 100) * n * 0.8; break;
      case "summon": flat += 0.6 * e.n!; break;
      case "revive": flat += e.v!; break;
      case "cleanse": flat += 0.2 * n; break;
      case "taunt": flat += 0.15 * e.dur!; break;
      case "stealth": flat += 0.2 * e.dur!; break;
      case "reflect": flat += e.v! * e.dur! * 0.3; break;
      case "steal": flat += 0.3; break;
      case "exec": flat += 0.25 * n * e.v! * 4; break;
      case "hurt": flat -= e.v! * 3; break;
      case "transform": flat += e.dur! * (Number(e.o.as ?? 0) * 0.25 + Number(e.o.amp ?? 0) * 0.35 + Number(e.o.vamp ?? 0) * 0.3); break;
      case "perm": flat += 0.3; break;
      case "loot": flat += 0.1; break;
    }
  }
  return { scal, flat };
}

const POWER_KEYS = new Set(["dmg", "dot", "heal", "shield", "zone", "chain", "multi"]);
function scalePower(fx: Fx[], k: number): Fx[] {
  return fx.map((e) => (POWER_KEYS.has(e.k) ? { ...e, p: Math.round(e.p! * k * 100) / 100 } : e));
}
/** Brings a spell's value to the target: powers are scaled, the rest is kept. */
function normalise(fx: Fx[], target: number): Fx[] {
  const { scal, flat } = spellValue(fx);
  if (scal <= 0) return fx;
  const k = Math.max(0.45, Math.min(1.8, (target - flat) / scal));
  return scalePower(fx, k);
}

// ------------------------------------------------------------ variants
/** What each element adds in the "elemental" variant: to enemies hit, or to allies helped. */
const EL_HARM: Record<Element, (w: string) => string> = {
  fire: (w) => `dot ${w} burn 0.35 3`, poison: (w) => `dot ${w} poison 0.35 4`, ice: (w) => `cc ${w} chill 2.5`, water: (w) => `mana ${w} -15`,
  lightning: (w) => `cc ${w} stun 0.6`, earth: (w) => `cc ${w} shred 4`, wind: (w) => `knock ${w} 1`, light: (w) => `cc ${w} blind 2`,
  dark: (w) => `cc ${w} weaken 3`, arcane: (w) => `cc ${w} silence 2`, physical: (w) => `dot ${w} bleed 0.35 3`,
};
const EL_HELP: Record<Element, (w: string) => string> = {
  fire: (w) => `buff ${w} amp 0.15 4`, ice: (w) => `buff ${w} armor 25 4`, water: (w) => `heal ${w} 0.3`, earth: (w) => `shield ${w} 0.4 4`,
  wind: (w) => `buff ${w} as 0.25 4`, light: (w) => `cleanse ${w}`, dark: (w) => `buff ${w} vamp 0.2 4`, poison: (w) => `buff ${w} dodge 0.2 4`,
  lightning: (w) => `mana ${w} 15`, arcane: (w) => `buff ${w} ap 15 4`, physical: (w) => `buff ${w} as 0.2 4`,
};
const EPITHET: Record<Element, string[]> = {
  fire: ["Hỏa Ngục", "Than Hồng", "Liệt Diễm", "Dung Nham"], ice: ["Băng Giá", "Hàn Băng", "Tuyết Lở", "Sương Muối"],
  water: ["Thủy Triều", "Sóng Ngầm", "Dòng Xoáy", "Lam Thủy"], earth: ["Địa Chấn", "Đá Tảng", "Hoàng Thổ", "Núi Lở"],
  wind: ["Cuồng Phong", "Lốc Xoáy", "Phong Nhận", "Thiên Không"], poison: ["Kịch Độc", "Chướng Khí", "Nọc Đen", "Tử Khí"],
  lightning: ["Lôi Đình", "Sấm Sét", "Thiên Lôi", "Tia Chớp"], light: ["Thánh Quang", "Bình Minh", "Hào Quang", "Kim Quang"],
  dark: ["Hắc Ám", "U Minh", "Bóng Đêm", "Huyết Nguyệt"], arcane: ["Huyền Bí", "Phù Văn", "Cổ Ngữ", "Tinh Thể"],
  physical: ["Sắt Thép", "Hoang Dã", "Bạo Liệt", "Gân Guốc"],
};

/** First effect that harms enemies, and first that helps allies. */
const harmWho = (fx: Fx[]) => fx.find((e) => ["dmg", "dot", "cc", "zone"].includes(e.k) && e.w && !e.w.startsWith("a:") && e.w !== "me" && !e.o.heal)?.w;
const helpWho = (fx: Fx[]) => fx.find((e) => ["heal", "shield", "buff", "hpct", "mana", "cleanse"].includes(e.k) && e.w?.startsWith("a:"))?.w;

/** Widens a spell: a bigger area, one more target or hit, or a splash. Returns the label. */
function widen(fx: Fx[]): { fx: Fx[]; label: string } {
  const out = fx.map((e) => ({ ...e, o: { ...e.o } }));
  const grow = (w: string): string | null => {
    const p = parseWho(w);
    if (p.base === "all" || p.base === "line" || p.base === "dead") return null;
    if (p.r >= 0) return `${p.ally ? "a:" : ""}${p.base}${p.n > 1 ? p.n : ""}@${p.r + 1}`;
    if (["rand", "near", "low", "high", "carry", "far", "back"].includes(p.base) && (p.n > 1 || p.ally)) return `${p.ally ? "a:" : ""}${p.base}${p.n + 1}`;
    return null;
  };
  // 1) areas and counts
  const first = out.find((e) => e.w && grow(e.w));
  if (first) {
    const from = first.w!, to = grow(from)!;
    for (const e of out) if (e.w === from) e.w = to;
    return { fx: out, label: parseWho(from).r >= 0 ? "Diện Rộng" : "Đa Mục Tiêu" };
  }
  // 2) more hits
  const rep = out.find((e) => e.k === "chain" || e.k === "multi" || (e.o.x && Number(e.o.x) > 1));
  if (rep) {
    if (rep.k === "chain" || rep.k === "multi") rep.n = rep.n! + 2; else rep.o.x = String(Number(rep.o.x) + 1);
    return { fx: out, label: "Liên Hoàn" };
  }
  // 3) a splash around the main target, or a wider zone / more allies
  const hw = harmWho(out);
  if (hw && !hw.startsWith("a:")) { out.push({ k: "dmg", w: `${parseWho(hw).base === "me" ? "me" : "t"}@1`, p: 0.35, o: { fx: "ring" } }); return { fx: out, label: "Lan Tỏa" }; }
  const z = out.find((e) => e.k === "zone");
  if (z) { z.r = (z.r ?? 1) + 1; return { fx: out, label: "Diện Rộng" }; }
  out.push({ k: "shield", w: "a:me@1", p: 0.4, dur: 4, o: {} });
  return { fx: out, label: "Che Chở" };
}

export interface SpellInput { id: string; role: Role; cost: Cost; el: Element; boss: boolean }

/**
 * Hands out the spells: each of the 600 ordinary units gets one base spell of its role in one
 * of three variants (each pair used once), each boss one ultimate of its own.
 */
/**
 * `starMult(cost)` gives the spell multiplier at ★1..★4 for a price, so descriptions can show
 * every star's numbers like TFT ("120 / 180 / 290 / 480").
 */
export function assignSpells(units: SpellInput[], spellBase: (cost: Cost) => number, starMult: (cost: Cost) => number[] = () => [1]): SpellDef[] {
  const out: SpellDef[] = new Array(units.length);
  const physicalRole = (r: Role) => r === "tank" || r === "brute" || r === "assassin" || r === "marksman";
  // ------------------------------------------------ ordinary units
  const free = new Map<string, number[]>(); // base id -> free variants
  const byRole: Record<string, Base[]> = BASE_SPELLS;
  for (const list of Object.values(byRole)) for (const b of list) free.set(b[0], [1, 2, 3]);
  const FALLBACK: Record<Role, Role[]> = {
    tank: ["brute", "support", "assassin"], brute: ["tank", "assassin", "marksman"], assassin: ["brute", "marksman", "tank"],
    marksman: ["mage", "assassin", "support"], mage: ["marksman", "support", "brute"], support: ["mage", "tank", "marksman"],
  };
  const order = units.map((u, i) => ({ u, i })).filter((x) => !x.u.boss).sort((a, b) => hashString(`o:${a.u.id}`) - hashString(`o:${b.u.id}`));
  for (const { u, i } of order) {
    const h = hashString(`sp:${u.id}`);
    let chosen: { base: Base; variant: number } | null = null;
    for (const role of [u.role, ...FALLBACK[u.role], ...(Object.keys(byRole) as Role[])]) {
      const list = byRole[role];
      for (let k = 0; k < list.length && !chosen; k++) {
        const b = list[(h + k) % list.length];
        const f = free.get(b[0])!;
        if (!f.length) continue;
        const v = f[(h >>> 4) % f.length];
        free.set(b[0], f.filter((x) => x !== v));
        chosen = { base: b, variant: v };
      }
      if (chosen) break;
    }
    if (!chosen) throw new Error(`no spell left for ${u.id}`);
    out[i] = makeVariant(chosen.base, chosen.variant, u, physicalRole(u.role), spellBase(u.cost), starMult(u.cost));
  }
  // ------------------------------------------------ bosses
  const left = new Set(ULTIMATES.map((x) => x[0]));
  const bosses = units.map((u, i) => ({ u, i })).filter((x) => x.u.boss).sort((a, b) => hashString(`b:${a.u.id}`) - hashString(`b:${b.u.id}`));
  for (const { u, i } of bosses) {
    const melee = physicalRole(u.role) && u.role !== "marksman";
    const h = hashString(`ult:${u.id}`);
    const pick = (fits: string[]) => {
      const cands = ULTIMATES.filter((x) => left.has(x[0]) && fits.includes(x[3]));
      return cands.length ? cands[h % cands.length] : null;
    };
    const ult = pick([melee ? "m" : "r"]) ?? pick(["a"]) ?? pick(["m", "r"])!;
    left.delete(ult[0]);
    const fx = scalePower(normalise(parseFx(ult[4]), 3), TUNE[ult[0]] ?? 1);
    const sp: SpellDef = { id: ult[0], name: ult[1], icon: ult[2], el: u.el, physical: physicalRole(u.role), fx, ult: true, base: ult[0], variant: 0, desc: "" };
    sp.desc = describe(sp, spellBase(u.cost), starMult(u.cost));
    out[i] = sp;
  }
  return out;
}

function makeVariant(b: Base, variant: number, u: SpellInput, physical: boolean, base: number, mults: number[]): SpellDef {
  const { passive, fx: src } = splitPassive(b[3]);
  // a passive goes off many times (or once): each time is worth a share of two casts
  const target = passive ? Math.min(3, (1.7 * 2.2) / triggerCount(passive)) : 1.7;
  let fx = scalePower(normalise(parseFx(src), target), TUNE[b[0]] ?? 1);
  let name = b[1];
  if (variant === 1) {
    fx = scalePower(fx, 1.12);
  } else if (variant === 2) {
    fx = scalePower(fx, 0.95);
    const hw = harmWho(fx), lw = helpWho(fx);
    const extra = hw ? EL_HARM[u.el](hw) : EL_HELP[u.el](lw ?? "a:me");
    fx = [...fx, ...parseFx(extra)];
    const words = EPITHET[u.el];
    name = `${b[1]} ${words[hashString(u.id) % words.length]}`;
  } else {
    const w = widen(scalePower(fx, 0.88));
    fx = w.fx;
    name = `${b[1]} ${w.label}`;
  }
  const sp: SpellDef = { id: `${b[0]}_${variant}`, name, icon: b[2], el: u.el, physical, fx, base: b[0], variant, desc: "", passive };
  sp.desc = describe(sp, base, mults);
  return sp;
}

// ------------------------------------------------------------ text
const CC_NAMES: Record<string, string> = {
  stun: "làm choáng", chill: "làm chậm", silence: "câm lặng", blind: "làm mù", weaken: "làm suy yếu (−25% sát thương)",
  shred: "phá giáp (−30% giáp và kháng)", mark: "đánh dấu (nhận +20% sát thương)",
};
const DOT_NAMES: Record<string, string> = { burn: "Thiêu đốt", poison: "Gây độc", bleed: "Gây chảy máu" };
const BUFF_NAMES: Record<string, (v: number) => string> = {
  as: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}% tốc đánh`, amp: (v) => `+${Math.round(v * 100)}% sát thương`, armor: (v) => `+${v} giáp và kháng phép`,
  dodge: (v) => `+${Math.round(v * 100)}% né tránh`, crit: (v) => `+${Math.round(v * 100)}% chí mạng`, vamp: (v) => `hút máu ${Math.round(v * 100)}%`,
  ap: (v) => `+${v} sức mạnh phép`, ad: (v) => `+${Math.round(v * 100)}% sát thương đòn đánh`,
};
const STACK_NAMES: Record<string, (v: number) => string> = {
  ad: (v) => `+${Math.round(v * 100)}% sát thương đòn đánh`, ap: (v) => `+${v} sức mạnh phép`, armor: (v) => `+${v} giáp`, as: (v) => `+${Math.round(v * 100)}% tốc đánh`, hp: (v) => `+${Math.round(v * 100)}% máu tối đa`,
};

const PERM_NAMES: Record<string, (v: number) => string> = {
  ap: (v) => `+${v} sức mạnh phép`, ad: (v) => `+${Math.round(v * 100)}% sát thương đòn đánh`, hp: (v) => `+${Math.round(v * 100)}% máu tối đa`, armor: (v) => `+${v} giáp`, as: (v) => `+${Math.round(v * 100)}% tốc đánh`,
};
function TRIGGER_TEXT(t: string): string {
  const n = t.match(/\d+$/)?.[0];
  if (t === "attack") return "Mỗi đòn đánh";
  if (t.startsWith("attack")) return `Mỗi ${n} đòn đánh`;
  if (t.startsWith("second")) return `Mỗi ${n} giây`;
  if (t.startsWith("struck")) return `Mỗi khi trúng ${n} đòn`;
  if (t === "kill") return "Mỗi khi hạ gục kẻ địch";
  if (t === "hurt50") return "Lần đầu tụt dưới 50% máu";
  if (t === "start") return "Đầu trận";
  return t;
}

export function whoText(w: string): string {
  const p = parseWho(w);
  const n = p.n > 1 ? `${p.n} ` : "";
  if (p.ally) {
    const area = p.r >= 0 ? ` trong ${p.r} ô` : "";
    switch (p.base) {
      case "me": return p.r >= 0 ? `đồng minh${area} (cả bản thân)` : "bản thân";
      case "low": return `${n || ""}đồng minh yếu máu nhất`;
      case "carry": return "đồng minh mạnh nhất";
      case "all": return "cả đội";
      default: return "đồng minh";
    }
  }
  const one: Record<string, string> = {
    t: "mục tiêu", near: `${n}kẻ địch gần nhất`, far: `${n}kẻ địch xa nhất`, low: `${n}kẻ địch yếu máu nhất`, high: `${n}kẻ địch nhiều máu nhất`,
    carry: `${n}kẻ địch nguy hiểm nhất`, back: `${n}kẻ địch hàng sau`, rand: p.n > 1 ? `${p.n} kẻ địch ngẫu nhiên` : "một kẻ địch ngẫu nhiên",
    dense: "nơi đông địch nhất", all: "mọi kẻ địch", line: "mọi kẻ địch trên đường thẳng tới mục tiêu", me: "bản thân",
  };
  if (p.r >= 0) return p.base === "me" ? `kẻ địch trong ${p.r} ô quanh mình` : `kẻ địch trong ${p.r} ô quanh ${one[p.base]}`;
  return one[p.base] ?? p.base;
}

const fmt = (n: number) => String(Math.round(n));
const secs = (n: number) => `${String(n).replace(".", ",")}s`;

/** Spell text with the numbers at one star (100 AP); they grow with stars. */
/** Spell text. Amounts are written "{a|b|c|d}" (one per star) when `mults` has several stars; see starValues(). */
export function describe(sp: SpellDef, base: number, mults: number[] = [1]): string {
  const kind = sp.physical ? "sát thương vật lý" : "sát thương phép";
  const parts: string[] = [];
  for (const e of sp.fx) {
    const w = e.w ? whoText(e.w) : "";
    const amt = e.p !== undefined ? (mults.length > 1 ? `{${mults.map((k) => fmt(base * e.p! * k)).join("|")}}` : fmt(base * e.p)) : "";
    const x = Number(e.o.x ?? 1);
    switch (e.k) {
      case "dmg": {
        const type = e.o.type === "t" ? "sát thương chuẩn" : e.o.type === "m" ? "sát thương phép" : e.o.type === "p" ? "sát thương vật lý" : kind;
        let s = `${e.o.delay ? `Sau ${secs(Number(e.o.delay))}, g` : "G"}ây ${x > 1 ? `${x} lần ${amt}` : amt} ${type} cho ${w}`;
        if (e.o.pierce) s += ", xuyên 40% giáp/kháng";
        if (e.o.ls) s += `, hồi máu bằng ${Math.round(Number(e.o.ls) * 100)}% sát thương gây ra`;
        parts.push(s);
        break;
      }
      case "dot": parts.push(`${DOT_NAMES[e.id!]} ${w}: ${amt} sát thương trong ${secs(e.dur!)}`); break;
      case "cc": parts.push(`${CC_NAMES[e.id!][0].toUpperCase()}${CC_NAMES[e.id!].slice(1)} ${w} ${secs(e.dur!)}`); break;
      case "heal": parts.push(`Hồi ${x > 1 ? `${x} lần ${amt}` : amt} máu cho ${w}`); break;
      case "hpct": parts.push(`Hồi ${Math.round(e.v! * 100)}% máu tối đa cho ${w}`); break;
      case "shield": parts.push(`Tạo khiên ${amt} cho ${w} trong ${secs(e.dur!)}`); break;
      case "buff": parts.push(`${w[0].toUpperCase()}${w.slice(1)} ${BUFF_NAMES[e.id!]?.(e.v!) ?? e.id}${e.id === "ap" || e.id === "ad" ? "" : ` trong ${secs(e.dur!)}`}`); break;
      case "stack": parts.push(`${sp.passive ? "Cộng dồn" : "Mỗi lần dùng chiêu: cộng dồn"} ${STACK_NAMES[e.id!]?.(e.v!) ?? e.id} đến hết giao tranh`); break;
      case "dash": parts.push(`Lướt tới ${w}`); break;
      case "blink": parts.push(`Dịch chuyển ra sau lưng ${w}`); break;
      case "knock": parts.push(`Đẩy lùi ${w} ${e.n} ô`); break;
      case "pull": parts.push(`Kéo ${w} lại gần`); break;
      case "swap": parts.push(`Đổi chỗ với ${w}`); break;
      case "mana": parts.push(e.v! > 0 ? `${w[0].toUpperCase()}${w.slice(1)} nhận ${e.v} năng lượng` : `Đốt ${-e.v!} năng lượng của ${w}`); break;
      case "zone": parts.push(`${e.o.heal ? "Tạo vùng hồi phục" : "Tạo vùng nguy hiểm"} ${e.w === "all" ? "phủ toàn bàn" : `bán kính ${e.r} ô quanh ${whoText(e.w!.replace(/@\d+$/, ""))}`} trong ${secs(e.dur!)}: mỗi giây ${e.o.heal ? `hồi ${amt} máu cho đồng minh` : `gây ${amt} ${kind}`}${e.o.slow ? `, làm chậm ${Math.round(Number(e.o.slow) * 100)}%` : ""}`); break;
      case "chain": parts.push(`Phóng tia nảy qua ${e.n} kẻ địch bắt đầu từ ${w}, mỗi lần gây ${amt} ${kind}`); break;
      case "multi": parts.push(`Tung ${e.n} đòn vào kẻ địch ngẫu nhiên, mỗi đòn ${amt} ${kind}`); break;
      case "summon": parts.push(`Triệu hồi ${e.n} thuộc hạ cùng tầng`); break;
      case "revive": parts.push(`Hồi sinh một đồng minh đã gục với ${Math.round(e.v! * 100)}% máu`); break;
      case "cleanse": parts.push(`Giải mọi hiệu ứng xấu cho ${w}`); break;
      case "taunt": parts.push(`Khiêu khích kẻ địch trong ${e.r} ô suốt ${secs(e.dur!)}`); break;
      case "stealth": parts.push(`Tàng hình ${secs(e.dur!)}`); break;
      case "reflect": parts.push(`Phản lại ${Math.round(e.v! * 100)}% sát thương nhận vào trong ${secs(e.dur!)}`); break;
      case "steal": parts.push(`Cướp ${e.v} ${e.id === "armor" ? "giáp" : e.id === "ad" ? "sát thương" : "năng lượng"} của ${w}`); break;
      case "exec": parts.push(`Kết liễu ${w} nếu còn dưới ${Math.round(e.v! * 100)}% máu`); break;
      case "hurt": parts.push(`Hy sinh ${Math.round(e.v! * 100)}% máu tối đa của bản thân`); break;
      case "perm": parts.push(`${e.o.kill ? "Nếu hạ gục được: v" : "V"}ĩnh viễn ${PERM_NAMES[e.id!]?.(e.v!) ?? e.id} (giữ suốt cả ván đấu)`); break;
      case "loot": {
        const what = e.id === "gold" ? `${e.n} vàng` : e.id === "xp" ? `${e.n} kinh nghiệm` : `${e.n} lượt đổi cửa hàng miễn phí`;
        parts.push(`${e.o.kill ? "Nếu hạ gục được: " : ""}${e.v! >= 1 ? "nhận" : `${Math.round(e.v! * 100)}% cơ hội nhận`} ${what}`);
        break;
      }
      case "transform": {
        const bits = [e.o.as && `+${Math.round(Number(e.o.as) * 100)}% tốc đánh`, e.o.amp && `+${Math.round(Number(e.o.amp) * 100)}% sát thương`, e.o.vamp && `hút máu ${Math.round(Number(e.o.vamp) * 100)}%`].filter(Boolean);
        parts.push(`Hóa cuồng ${secs(e.dur!)}: ${bits.join(", ")}`);
        break;
      }
    }
  }
  const head = sp.passive ? `Nội tại (không cần năng lượng) — ${TRIGGER_TEXT(sp.passive)}: ` : "";
  return head + parts.join(". ") + "." + (sp.ult ? " (Tối thượng)" : "");
}

/** Splits a description into text and per-star amounts ({a|b|c|d}) for display. */
export function starValues(desc: string): (string | number[])[] {
  return desc.split(/\{([^}]+)\}/).map((part, i) => (i % 2 ? part.split("|").map(Number) : part));
}
/** The description at one star (plain numbers). */
export const descAt = (desc: string, star: number) => starValues(desc).map((x) => (typeof x === "string" ? x : String(x[Math.min(x.length, star) - 1]))).join("");

/** Every debuff id the language knows (for the screen's names). */
export const SPELL_DEBUFFS: Debuff[] = ["stun", "chill", "silence", "blind", "weaken", "shred", "mark", "burn", "poison", "bleed"];
