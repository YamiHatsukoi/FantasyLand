import { app } from "../app";
import { syncLook, type Character } from "../core/state";
import { HAIR_STYLES } from "../render/hair";
import { lookFor, personCanvas, portraitCanvas, type Dir, type HairStyle, type Hat } from "../render/people";
import { h, openModal } from "../ui/dom";

/** Appearance editor: body/face/hair chosen by the player; clothes and weapon come from equipped gear. */

const HAIR_CHOICES: [HairStyle, string][] = HAIR_STYLES.map((h) => [h.id, h.name]);
const HAIR_COLORS = ["#1a1a1a", "#3a2418", "#6b3f22", "#a0652e", "#d8a040", "#f0d890", "#e8e8f0", "#9a9aa8", "#c83a2a", "#e87aa8", "#8a4ad8", "#3a7ad8", "#3aa878", "#2a4a3a"];
const EYE_COLORS = ["#2a3a6a", "#3a8a5a", "#6a3a1a", "#1a1a1a", "#8a8a9a", "#b0302a", "#8a4ad8", "#e0a020", "#8ad8ff", "#ffe14a"];
const SKINS = ["#fbe0c8", "#f2c8a0", "#e0b088", "#c68a5a", "#a06a40", "#6e4428", "#e0dcd8", "#9ad0d8", "#8ab070", "#6a5a8a"];
const HATS: [Hat, string][] = [["none", "Không"], ["hood", "Mũ trùm"], ["bandana", "Khăn"], ["cap", "Mũ lưỡi trai"], ["circlet", "Vòng"], ["flower", "Hoa"], ["straw", "Nón rơm"], ["wizard", "Mũ pháp sư"], ["witch", "Mũ phù thuỷ"], ["helmet", "Mũ sắt"]];

export function openAppearance(ch: Character, done: () => void, always = false) {
  const before = JSON.stringify(ch.pal ?? {});
  const pal: Record<string, string> = { ...(ch.pal ?? {}) };
  const m = openModal(`Ngoại hình — ${ch.name}`, {
    wide: true,
    onClose: () => {
      clearInterval(timer);
      if (JSON.stringify(ch.pal ?? {}) !== before) app.dirty();
      if (always || JSON.stringify(ch.pal ?? {}) !== before) done();
    },
  });

  const size = (c: HTMLCanvasElement, s: number) => { c.style.width = `${c.width * s}px`; c.style.height = `${c.height * s}px`; c.style.imageRendering = "pixelated"; return c; };
  const portraitBox = h("div", { style: "background:#1f2a3a;border-radius:8px;padding:6px" });
  const walkers = h("div", { class: "row", style: "gap:10px;align-items:flex-end" });
  let frame = 0;
  const draw = () => {
    portraitBox.replaceChildren(size(portraitCanvas(ch.sprite, pal), 3));
    walkers.replaceChildren(...([0, 2, 1] as Dir[]).map((d) => h("div", { style: "background:#3a5a32;border-radius:8px;padding:4px" }, size(personCanvas(ch.sprite, pal, d, frame), 3))));
  };
  const timer = setInterval(() => { frame = (frame + 1) % 4; if (!m.el.isConnected) clearInterval(timer); else draw(); }, 220);

  const apply = (k: string, v: string | null) => {
    if (v === null) delete pal[k]; else pal[k] = v;
    ch.pal = { ...pal };
    syncLook(ch);
    Object.assign(pal, ch.pal ?? {});
    render();
  };

  const L0 = () => lookFor(ch.sprite, pal);
  const swatches = (key: string, cols: string[], cur: string) => h("div", { class: "row wrap", style: "gap:6px" }, cols.map((c) =>
    h("button", {
      "aria-label": c,
      style: `width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c.toLowerCase() === cur.toLowerCase() ? "#ffe14a" : "rgba(255,255,255,.25)"};cursor:pointer`,
      onclick: () => apply(key, c),
    })));
  const chips = <T extends string>(key: string, opts: [T, string][], cur: string) => h("div", { class: "row wrap", style: "gap:6px" }, opts.map(([v, label]) =>
    h("button", { class: `btn small ${v === cur ? "primary" : ""}`, onclick: () => apply(key, v) }, label)));
  const section = (title: string, ...kids: HTMLElement[]) => h("div", { class: "col", style: "gap:6px" }, h("b", null, title), ...kids);

  const controls = h("div", { class: "col grow", style: "gap:12px;min-width:240px" });
  const render = () => {
    const L = L0();
    draw();
    controls.replaceChildren(
      section("Giới tính", chips("g", [["m", "Nam"], ["f", "Nữ"]], L.fem ? "f" : "m")),
      section(`Kiểu tóc (${HAIR_CHOICES.length})`, chips("hs", HAIR_CHOICES, L.hairStyle)),
      section("Màu tóc", swatches("hc", HAIR_COLORS, L.hair)),
      section("Màu mắt", swatches("ec", EYE_COLORS, L.eyes)),
      section("Màu da", swatches("sk", SKINS, L.skin)),
      section("Râu", chips("bd", [["0", "Không"], ["1", "Có"]], L.beard ? "1" : "0")),
      section("Mũ / phụ kiện đầu", chips("ht", HATS, L.hat)),
      h("div", { class: "muted small" }, "👕 Quần áo và 🗡️ vũ khí trên tay hiển thị theo trang bị đang mặc — đổi trang bị ở bảng Đội Hình."),
      h("div", { class: "row", style: "gap:8px" },
        h("button", {
          class: "btn small",
          onclick: () => { for (const k of ["g", "hs", "hc", "ec", "sk", "bd", "ht"]) delete pal[k]; ch.pal = { ...pal }; syncLook(ch); render(); },
        }, "↺ Mặc định"),
        h("button", { class: "btn primary", onclick: () => m.close() }, "Xong")),
    );
  };

  m.body.append(h("div", { class: "row wrap", style: "gap:16px;align-items:flex-start" },
    h("div", { class: "col", style: "gap:10px;align-items:center" }, portraitBox, walkers),
    controls));
  render();
}
