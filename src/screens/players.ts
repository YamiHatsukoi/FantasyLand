import { app } from "../app";
import { GEAR_KEYS } from "../core/state";
import { RANK_NAMES } from "../data/buildings";
import { CLASSES } from "../data/classes";
import { getItem, type GearKey } from "../data/items";
import { errorText, listPlayers, visitPlayer, type PlayerSummary, type PlayerVisit, type PublicChar } from "../net/api";
import { spriteImg } from "../render/pixel";
import { h, nn, openModal, toast } from "../ui/dom";
import { GEAR_ICONS, GEAR_NAMES, rarityClass } from "../ui/gear";
import { itemImg } from "../ui/icon";
import { itemTip } from "../ui/tooltip";

/** "vừa xong", "5 phút trước", "3 ngày trước" */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "vừa xong";
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}

const classLine = (c: PublicChar) => {
  const cls = CLASSES[c.classId];
  return `${cls?.icon ?? "❔"} ${cls?.name ?? c.classId} · Cấp ${c.level}`;
};

const safeSprite = (c: PublicChar, cls: string) => {
  try { return spriteImg(c.sprite, c.pal, cls); } catch { return h("span", { class: cls }, "🙂"); }
};

/** Everyone else on the server: newest activity first. */
export function openPlayers(visit: (p: PlayerVisit) => void) {
  const s = app.session;
  const m = openModal("🌐 Người Chơi Khác", { wide: true });
  if (!s || s.offline) {
    m.body.append(h("p", { class: "muted" }, "Bạn đang chơi ngoại tuyến. Tính năng này cần đăng nhập vào máy chủ."));
    return;
  }
  m.body.append(h("p", { class: "muted" }, "Đang tải…"));
  listPlayers(s).then((list) => {
    if (!list.length) { m.body.replaceChildren(h("p", { class: "muted" }, "Chưa có ai khác trên máy chủ.")); return; }
    m.body.replaceChildren(
      h("p", { class: "muted small", style: "margin-top:0" }, `${list.length} người chơi. Chạm để xem hồ sơ, hoặc sang thăm Thánh Địa của họ (chỉ đi dạo ngắm, không động vào được gì).`),
      h("div", { class: "list" }, list.map((p) => playerRow(p, visit))));
  }).catch((e) => m.body.replaceChildren(h("p", { class: "bad" }, errorText(e))));
}

function playerRow(p: PlayerSummary, visit: (p: PlayerVisit) => void) {
  const hero = p.hero;
  return h("div", { class: "item-row player-row" },
    hero ? safeSprite(hero, "sprite mini-portrait") : h("span", { class: "ico" }, "🙂"),
    h("div", { class: "meta" },
      h("div", { class: "name" }, hero?.name ?? p.username, h("span", { class: "tag" }, `@${p.username}`)),
      h("div", { class: "desc" }, hero ? classLine(hero) : "", ` · 🕳️ Tầng ${p.max_floor || 0}`),
      h("div", { class: "desc muted" }, `🏘️ ${RANK_NAMES[p.rank] ?? ""} · ${p.buildings} công trình · Ngày ${p.day} · ${ago(p.updated_at)}`)),
    h("div", { class: "col", style: "gap:4px" },
      h("button", { class: "btn small", onclick: () => openProfile(p.username, visit) }, "👤 Hồ sơ"),
      h("button", { class: "btn small primary", onclick: () => goVisit(p.username, visit) }, "🏡 Thăm")));
}

async function load(username: string): Promise<PlayerVisit | null> {
  try { return await visitPlayer(app.session!, username); } catch (e) { toast(errorText(e), "bad"); return null; }
}

async function goVisit(username: string, visit: (p: PlayerVisit) => void) {
  const v = await load(username);
  if (v) visit(v);
}

/** Read-only profile: party, gear (hover for details) and a few numbers. */
export async function openProfile(username: string, visit?: (p: PlayerVisit) => void, data?: PlayerVisit) {
  const v = data ?? (await load(username));
  if (!v) return;
  const party = v.party.filter((c, i, all): c is PublicChar => !!c && all.findIndex((o) => o?.id === c.id) === i);
  const hero = party.find((c) => c.id === v.heroId) ?? party[0];
  const rank = v.buildings.find((b) => b.type === "house")?.level ?? 1;
  const m = openModal(`👤 ${hero?.name ?? v.username}`, { wide: true, cls: "no-autosearch" });
  let cur = hero?.id;
  const render = () => {
    const ch = party.find((c) => c.id === cur) ?? hero;
    const st = v.stats ?? {};
    const num = (icon: string, label: string, val: string | number) => h("div", { class: "stat" }, `${icon} ${label}`, h("b", null, String(val)));
    m.body.replaceChildren(...nn(
      h("div", { class: "muted small", style: "margin-bottom:8px" }, `@${v.username} · hoạt động ${ago(v.updated_at)}`),
      h("div", { class: "grid2", style: "margin-bottom:10px" },
        num("🕳️", "Tầng sâu nhất", v.maxFloor ?? 0),
        num("🏘️", "Thánh Địa", RANK_NAMES[rank] ?? ""),
        num("📅", "Ngày", v.day ?? 1),
        num("🏗️", "Công trình", v.buildings.length),
        num("👥", "Đồng đội", Math.max(0, (v.residents ?? 1) - 1)),
        num("⚔️", "Trận thắng / Quái hạ", `${st.battles ?? 0} / ${st.kills ?? 0}`)),
      h("div", { class: "section-title" }, "Đội hình"),
      h("div", { class: "char-tabs" }, party.map((c) => h("button", { class: `char-tab ${c.id === ch?.id ? "on" : ""}`, onclick: () => { cur = c.id; render(); } },
        safeSprite(c, "sprite"), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, `Lv${c.level}`)))),
      ch ? h("div", { class: "party-head" }, safeSprite(ch, "sprite big-portrait"),
        h("div", { class: "grow" }, h("b", { style: "font-size:17px" }, ch.name), h("div", { class: "muted small" }, classLine(ch)),
          ch.bond ? h("div", { class: "small gold" }, ch.bond === "beloved" ? "💍 Người thương" : "🤝 Tri kỷ") : null)) : null,
      ch ? h("div", { class: "gear-tiles" }, GEAR_KEYS.map((key: GearKey) => {
        const id = ch.gear?.[key];
        let it = null;
        try { it = id ? getItem(id) : null; } catch { it = null; }
        const enh = ch.enh?.[key];
        const tile = h("div", { class: `gtile ${it ? `filled ${rarityClass(it)}` : ""}` },
          h("div", { class: "gt-ico" }, it ? itemImg(it.id) : h("span", { class: "gt-empty" }, GEAR_ICONS[key])),
          h("div", { class: "gt-name" }, it ? it.name : GEAR_NAMES[key]),
          enh ? h("span", { class: "gt-enh" }, `+${enh}`) : null);
        return it ? itemTip(tile, it.id, { enh, slot: key }) : tile;
      })) : null,
      visit ? h("div", { class: "row end", style: "margin-top:10px" }, h("button", { class: "btn primary", onclick: () => { m.close(); visit(v); } }, "🏡 Sang thăm Thánh Địa")) : null,
    ));
  };
  render();
}
