import { openCodex } from "./codex";
import { applySettings, settings as audio } from "../audio/engine";
import { sfx } from "../audio/sfx";
import { app } from "../app";
import { charStats } from "../core/state";
import { ONLINE, clearSession, errorText, logout } from "../net/api";
import { spriteImg } from "../render/pixel";
import { getNpc, hearts, questGoal, questLog, questProgress } from "../world/people";
import { getFloor } from "../world/floors";
import { bar, confirmBox, h, openModal, toast } from "../ui/dom";

export function partyMini(): { el: HTMLElement; update: () => void } {
  const el = h("div", { class: "party-mini" });
  const update = () => {
    const g = app.game;
    el.replaceChildren(...g.party.map((id) => {
      const ch = g.chars[id];
      const s = charStats(ch);
      return h("div", { class: "pm", title: ch.name }, spriteImg(ch.sprite, ch.pal), bar(ch.hp, s.hp, "hp"), bar(ch.mp, s.mp, "mp"));
    }));
  };
  update();
  return { el, update };
}

const STATUS_TEXT: Record<string, string> = {
  saved: "Đã lưu lên máy chủ", saving: "Đang lưu…", dirty: "Có thay đổi chưa lưu", offline: "Chế độ offline (lưu trên máy)",
  error: "Lỗi mạng — sẽ thử lại", conflict: "Xung đột dữ liệu với thiết bị khác", auth: "Phiên đăng nhập hết hạn",
};

export function saveDot(): HTMLElement {
  const dot = h("span", { class: "save-dot" });
  const set = (s: string) => { dot.className = `save-dot ${s}`; dot.title = STATUS_TEXT[s] ?? s; };
  set(app.saver?.status ?? "saved");
  if (app.saver) {
    const prev = app.saver.onStatus;
    app.saver.onStatus = (s) => {
      prev?.(s);
      set(s);
      if (s === "conflict") void resolveConflict();
      if (s === "auth") void sessionExpired();
    };
  }
  return dot;
}

let authOpen = false;
let authDeclined = false;
async function sessionExpired() {
  if (authOpen || authDeclined) return;
  authOpen = true;
  const ok = await confirmBox("Phiên đăng nhập hết hạn",
    "Tiến trình vẫn được giữ an toàn trên thiết bị này. Hãy đăng nhập lại — bản lưu trên máy sẽ được đồng bộ lên máy chủ ngay sau đó.",
    "Đăng nhập lại", "Để sau");
  authOpen = false;
  if (!ok) { authDeclined = true; return; }
  clearSession();
  location.reload();
}

let conflictOpen = false;
async function resolveConflict() {
  if (conflictOpen || !app.saver) return;
  conflictOpen = true;
  const keep = await confirmBox("Xung đột dữ liệu",
    "Tài khoản này vừa được lưu từ một thiết bị/tab khác. Bạn muốn giữ tiến trình trên thiết bị NÀY (ghi đè bản kia), hay tải lại bản mới nhất từ máy chủ?",
    "Giữ bản này", "Tải bản mới nhất");
  conflictOpen = false;
  if (keep) await app.saver.forceSave();
  else {
    app.saver.clearLocal();
    location.reload();
  }
}

export function showBanner(root: HTMLElement, text: string, sub = "") {
  const b = h("div", { class: "banner" }, text, sub ? h("small", null, sub) : null);
  for (const old of root.querySelectorAll(".banner")) old.remove();
  root.append(b);
  setTimeout(() => b.remove(), 2700);
}

export function openMenu(extra: HTMLElement[] = []) {
  const m = openModal("Menu");
  const status = h("span", null, STATUS_TEXT[app.saver?.status ?? "saved"]);
  m.body.append(
    h("div", { class: "col" },
      h("div", { class: "stat" }, "Tài khoản", h("b", null, app.session?.username ?? "")),
      h("div", { class: "stat" }, "Lưu trữ", status),
      soundSettings(),
      ...extra,
      h("button", {
        class: "btn blue",
        onclick: async () => {
          app.dirty(true);
          try { await app.saver?.flush(true); toast(ONLINE ? "Đã lưu lên máy chủ." : "Đã lưu trên thiết bị.", "good"); } catch (e) { toast(errorText(e), "bad"); }
          status.textContent = STATUS_TEXT[app.saver?.status ?? "saved"];
        },
      }, "💾 Lưu ngay"),
      h("button", { class: "btn", onclick: () => openHelp() }, "❓ Hướng dẫn"),
      h("button", { class: "btn", onclick: () => { const doc = document.documentElement; if (!document.fullscreenElement) void doc.requestFullscreen?.().catch(() => undefined); else void document.exitFullscreen(); } }, "⛶ Toàn màn hình"),
      h("button", {
        class: "btn",
        onclick: async () => {
          if (!(await confirmBox("Chơi lại từ đầu", "Toàn bộ tiến trình của tài khoản này (trên máy chủ và trên thiết bị) sẽ bị XOÁ VĨNH VIỄN. Không thể hoàn tác.", "Xoá và chơi lại"))) return;
          if (!(await confirmBox("Chắc chắn chứ?", "Lần xác nhận cuối: xoá hết và bắt đầu lại từ đầu?", "Xoá hết"))) return;
          try { await app.saver?.wipe(); location.reload(); } catch (e) { toast(errorText(e), "bad"); }
        },
      }, "🔄 Chơi lại từ đầu"),
      h("button", {
        class: "btn",
        onclick: async () => {
          if (!(await confirmBox("Đăng xuất", "Tiến trình sẽ được lưu trước khi đăng xuất. Lần sau bạn cần nhập lại tên và mật khẩu."))) return;
          try { await app.saver?.flush(true); } catch { /* keep local copy */ }
          if (app.session) await logout(app.session);
          location.reload();
        },
      }, "🚪 Đăng xuất"),
    ),
  );
}

/** Music and sound effects: on/off and volume each, remembered on this device. */
function soundSettings() {
  const row = (label: string, on: "music" | "sfx", vol: "musicVol" | "sfxVol") => {
    const slider = h("input", { type: "range", min: "0", max: "100", value: String(Math.round(audio[vol] * 100)), class: "snd-vol", disabled: !audio[on] }) as HTMLInputElement;
    slider.addEventListener("input", () => { audio[vol] = Number(slider.value) / 100; applySettings(); });
    slider.addEventListener("change", () => { if (on === "sfx") sfx("coin"); });
    const box = h("input", { type: "checkbox", checked: audio[on] }) as HTMLInputElement;
    box.addEventListener("change", () => { audio[on] = box.checked; slider.disabled = !box.checked; applySettings(); if (on === "sfx" && box.checked) sfx("good"); });
    return h("div", { class: "snd-row" }, h("label", { class: "check" }, box, label), slider);
  };
  return h("div", { class: "snd" }, h("div", { class: "section-title" }, "🔊 Âm thanh"), row("🎵 Nhạc nền", "music", "musicVol"), row("🔔 Hiệu ứng", "sfx", "sfxVol"));
}

export function openHelp() {
  const m = openModal("Hướng Dẫn", { wide: true });
  const sec = (t: string, ...p: string[]) => [h("div", { class: "section-title" }, t), ...p.map((x) => h("p", { style: "margin:4px 0;line-height:1.55" }, x))];
  m.body.append(
    ...sec("🏡 Thánh Địa", "Chạm vào công trình để sử dụng. Nút 🔨 Xây để đặt công trình mới, kéo màn hình để di chuyển camera khi đặt.",
      "Mỗi lần ngủ ở Nhà Chính là một ngày trôi qua: công trình sản xuất, dân chúng ăn uống, thời tiết và mùa thay đổi. Mỗi mùa dài 7 ngày.",
      "🌱 Nông trại chạy theo thời gian thật: cây lớn từng giây (nhanh nhất 15 giây, cây ăn trái vài phút), kể cả khi bạn đang ở Vực Sâu hay tắt game (tối đa 8 giờ). Mỗi lần tưới giữ ẩm 3 phút — ô khô thì cây lớn chậm (cây khát nước sẽ ngừng lớn) và mất thưởng được mùa (+50%). Mưa, Vòi Tưới và Nhà Kính tự lo nước. Gieo hạt đúng mùa, bón phân nâng cấp đất; một số cây thu hoạch nhiều lần; hai giống bố mẹ chín cạnh ô trống có thể ra giống lai.",
      "🏘️ Thăng hạng Thánh Địa: Trại → Xóm → Làng → Thị Trấn → Thành Phố → Kinh Đô. Cần dân số và độ sâu đã tới. Dân tới ở khi có nhà và đủ lương thực, làm việc ở các công trình sản xuất.",
      "📌 Nút Việc cho biết những gì đang chờ bạn: ruộng chín, điểm chỉ số chưa dùng, đồ trong túi tốt hơn đồ đang mặc (ô trang bị có dấu ⬆), cư dân có chuyện muốn nói, việc nhờ đã xong. Con số đỏ trên các nút là số việc có thể làm ngay. Trong túi đồ, đồ mới nhận có nhãn MỚI, đồ tốt hơn cho đồng đội có dấu ⬆; tìm kiếm không cần gõ dấu.",
      "⚒️ Các trạm chế tạo (Bếp, Giả Kim, Lò Rèn, Xưởng Cưa, Xưởng Đá, Xưởng May, Hố Ủ Phân, Thư Viện) có hàng trăm công thức từ nguyên liệu của Vực Sâu."),
    ...sec("💞 Cư dân & tình cảm", "Mọi đồng đội bạn chiêu mộ đều về sống ở Thánh Địa: họ đi làm, đi dạo, trò chuyện với nhau. Chạm vào ai đó (hoặc mở 💞 Cư dân) để nói chuyện.",
      "Mỗi người có tính cách, chủ đề yêu thích và ghét, giá trị sống, món quà ưa thích, sinh nhật, và một câu chuyện riêng (ước mơ, vết thương, bí mật). Hỏi thăm, trò chuyện đúng chủ đề, tâm sự, tặng quà, rủ đi chơi để tăng ❤️ tình bạn (tối đa 10). Mỗi ngày được 4 lượt trò chuyện với mỗi người.",
      "Ở 2, 4, 6, 8 và 10 ❤️ sẽ có cảnh riêng (dấu ❗ trên đầu). Đạt 10 ❤️ và giúp họ thực hiện lời nhờ, họ thành Tri Kỷ và được nội tại chiến đấu.",
      "💗 Tình cảm: từ 3 ❤️ có thể tán tỉnh — mỗi người thích một kiểu khác nhau. Khi đủ thân sẽ có lời thổ lộ. Tặng 💐 Bó Hoa Tỏ Tình để hẹn hò, 💍 Nhẫn Đính Ước để cầu hôn (mua ở quầy của Mầm). Chỉ hẹn hò một người: ve vãn người khác có thể khiến người ấy ghen, thậm chí chia tay."),
    ...sec("🗺️ Vực Sâu", "Chạm vào ô để di chuyển (hoặc WASD / phím mũi tên). Chạm lên quái vật để lao vào đánh úp.",
      "❗ là sự kiện cốt truyện, ❓ là sự kiện ngẫu nhiên, rương báu, lửa trại (hồi phục), điểm thu thập tài nguyên.",
      "Đánh bại Boss Canh Cửa để mở cầu thang. Cổng Dịch Chuyển ở đầu tầng đưa bạn về nhà hoặc tới đầu bất kỳ tầng nào đã mở khoá. Nếu gục ngã, bạn mất một nửa chiến lợi phẩm của chuyến đi.",
      "🏘️ Hầu hết các tầng có làng, thị trấn hoặc thành phố thật sự trên bản đồ: đi dọc phố, chạm vào cửa tiệm (biển hiệu trên mái) để mua bán, vào nhà trọ để nghỉ, gõ cửa nhà dân hoặc bắt chuyện với người đi đường, chạm vào đài phun nước / giếng ở quảng trường để xem cả làng. Có những tầng khắc nghiệt tới mức không ai sống nổi. Mỗi tầng có một đặc sản ✨ và một di vật 🏺 độc nhất do Boss Canh Cửa giữ.",
      "🏘️ Mỗi tầng có làng, thị trấn hoặc thành phố với cửa hàng, quán trọ và cư dân. Mỗi người có tính cách, sở thích, trí nhớ riêng — trò chuyện, tặng quà, giúp việc để thân hơn và chiêu mộ họ. Đội mang theo bạn + 3 người. Mỗi đồng đội cần một chỗ ngủ ở Thánh Địa — xây thêm nhà để chiêu mộ thêm, hoặc tiễn bớt người ở màn Đội Hình."),
    ...sec("⚔️ Chiến đấu", "Theo lượt, thứ tự theo Tốc độ (thanh trên cùng). Chọn kỹ năng rồi chạm mục tiêu. Chạm kẻ địch để xem điểm yếu nguyên tố.",
      "Phản ứng nguyên tố: Ướt + Sét = Điện Giật (choáng), Ướt + Băng = Đóng Băng, Dầu + Lửa = Nổ Dầu, Đóng Băng + đòn vật lý = Vỡ Băng (x2), Thiêu đốt + Gió = Bão Lửa (lây lan), Nhiễm điện + Đất = Tiếp Địa...",
      "Tầng hiệu ứng: 3 tầng Tê cóng → Đóng băng; 3 tầng Nhiễm điện → Tê liệt. Kỹ năng Kích nổ tiêu thụ tầng hiệu ứng để gây sát thương lớn.",
      "Chạm biểu tượng hiệu ứng để xem mô tả. Bật ⚙️ Tự động để AI đánh thay."),
  );
}

export function openJournal() {
  const g = app.game;
  const m = openModal("Nhật Ký", { wide: true });
  const thorns = g.inventory.black_thorn ?? 0;
  const floors = [];
  for (let f = 1; f <= g.maxFloor; f++) {
    const fs = g.floors[f];
    floors.push(h("div", { class: "stat" }, `Tầng ${f}: ${getFloor(f).name}`, h("b", null, fs?.cleared ? "✔ Đã chinh phục" : fs ? "Đang khám phá" : "Chưa tới")));
  }
  m.body.append(
    h("button", { class: "btn", style: "align-self:flex-start;margin-bottom:8px", onclick: () => { m.close(); openCodex(); } }, "📖 Sổ Tay Quái Vật"),
    h("div", { class: "grid2" },
      h("div", { class: "stat" }, "Ngày", h("b", null, String(g.day))),
      h("div", { class: "stat" }, "Tầng sâu nhất", h("b", null, String(g.maxFloor))),
      h("div", { class: "stat" }, "Gai Đen", h("b", null, `🖤 ${thorns}`)),
      h("div", { class: "stat" }, "Trận đấu", h("b", null, String(g.stats.battles))),
      h("div", { class: "stat" }, "Quái hạ gục", h("b", null, String(g.stats.kills))),
      h("div", { class: "stat" }, "Số lần gục ngã", h("b", null, String(g.stats.deaths))),
    ),
    h("div", { class: "section-title" }, "Việc đang nhận"),
    (() => {
      const ql = questLog(g);
      return ql.length
        ? h("div", { class: "col", style: "gap:4px" }, ql.map(({ npc, q }) => {
          const pr = questProgress(g, q, npc);
          return h("div", { class: "stat" }, `${npc.name} (${npc.town}, tầng ${npc.floor}): ${questGoal(q, npc)}`, h("b", null, pr.ok ? "✅" : `${pr.have}/${pr.need}`));
        }))
        : h("p", { class: "muted small" }, "Chưa nhận việc nào. Cư dân các làng dưới Vực Sâu sẽ nhờ bạn khi đã quen biết.");
    })(),
    h("div", { class: "section-title" }, "Người quen"),
    (() => {
      const known = Object.entries(g.npcs).filter(([id]) => /^n\d+_/.test(id)).sort((a, b) => b[1].aff - a[1].aff).slice(0, 20);
      return known.length
        ? h("div", { class: "col", style: "gap:4px" }, known.map(([id, mem]) => { const n = getNpc(id); return h("div", { class: "stat" }, `${n.name} — ${n.town} (tầng ${n.floor})`, h("b", null, `${hearts(mem.aff)} ${mem.aff}`)); }))
        : h("p", { class: "muted small" }, "Chưa quen ai.");
    })(),
    h("div", { class: "section-title" }, "Các tầng"),
    h("div", { class: "col", style: "gap:4px" }, floors),
    h("div", { class: "section-title" }, "Sự kiện gần đây"),
    g.log.length ? h("div", { class: "col", style: "gap:4px" }, g.log.map((l) => h("div", { class: "small muted" }, l))) : h("p", { class: "muted" }, "Chưa có gì."),
  );
}
