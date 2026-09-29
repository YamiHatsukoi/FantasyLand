import { app } from "../app";
import { charStats } from "../core/state";
import { ONLINE, clearSession, errorText, logout } from "../net/api";
import { spriteImg } from "../render/pixel";
import { getFloor } from "../world/floors";
import { bar, confirmBox, h, openModal, toast } from "../ui/dom";

export function partyMini(): { el: HTMLElement; update: () => void } {
  const el = h("div", { class: "party-mini" });
  const update = () => {
    const g = app.game;
    el.replaceChildren(...g.party.map((id) => {
      const ch = g.chars[id];
      const s = charStats(ch);
      return h("div", { class: "pm", title: ch.name }, spriteImg(ch.sprite), bar(ch.hp, s.hp, "hp"), bar(ch.mp, s.mp, "mp"));
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
          if (!(await confirmBox("Đăng xuất", "Tiến trình sẽ được lưu trước khi đăng xuất. Lần sau bạn cần nhập lại tên và mật khẩu."))) return;
          try { await app.saver?.flush(true); } catch { /* keep local copy */ }
          if (app.session) await logout(app.session);
          location.reload();
        },
      }, "🚪 Đăng xuất"),
    ),
  );
}

export function openHelp() {
  const m = openModal("Hướng Dẫn", { wide: true });
  const sec = (t: string, ...p: string[]) => [h("div", { class: "section-title" }, t), ...p.map((x) => h("p", { style: "margin:4px 0;line-height:1.55" }, x))];
  m.body.append(
    ...sec("🏡 Thánh Địa", "Chạm vào công trình để sử dụng. Nút 🔨 Xây để đặt công trình mới, kéo màn hình để di chuyển camera khi đặt.",
      "Gieo hạt ở Ô Ruộng; mỗi lần ngủ ở Nhà Chính là một ngày trôi qua. Bạn chỉ buồn ngủ sau khi đã xuống Vực Sâu.",
      "Bếp, Phòng Giả Kim, Lò Rèn biến nguyên liệu thành đồ ăn, thuốc, bom và trang bị. Thư Viện dùng Tinh Thể Ma Lực để học kỹ năng mới."),
    ...sec("🗺️ Vực Sâu", "Chạm vào ô để di chuyển (hoặc WASD / phím mũi tên). Chạm lên quái vật để lao vào đánh úp.",
      "❗ là sự kiện cốt truyện, ❓ là sự kiện ngẫu nhiên, rương báu, lửa trại (hồi phục), điểm thu thập tài nguyên.",
      "Đánh bại kẻ canh giữ tầng để mở cầu thang. Quay về bằng Cổng Dịch Chuyển ở đầu tầng. Nếu gục ngã, bạn mất một nửa chiến lợi phẩm của chuyến đi."),
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
    h("div", { class: "grid2" },
      h("div", { class: "stat" }, "Ngày", h("b", null, String(g.day))),
      h("div", { class: "stat" }, "Tầng sâu nhất", h("b", null, String(g.maxFloor))),
      h("div", { class: "stat" }, "Gai Đen", h("b", null, `🖤 ${thorns}`)),
      h("div", { class: "stat" }, "Trận đấu", h("b", null, String(g.stats.battles))),
      h("div", { class: "stat" }, "Quái hạ gục", h("b", null, String(g.stats.kills))),
      h("div", { class: "stat" }, "Số lần gục ngã", h("b", null, String(g.stats.deaths))),
    ),
    h("div", { class: "section-title" }, "Các tầng"),
    h("div", { class: "col", style: "gap:4px" }, floors),
    h("div", { class: "section-title" }, "Sự kiện gần đây"),
    g.log.length ? h("div", { class: "col", style: "gap:4px" }, g.log.map((l) => h("div", { class: "small muted" }, l))) : h("p", { class: "muted" }, "Chưa có gì."),
  );
}
