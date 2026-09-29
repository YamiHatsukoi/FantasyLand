import type { Screen } from "../app";
import { ONLINE, cacheSession, errorText, login, type Session } from "../net/api";
import { h } from "../ui/dom";

export function mountLogin(root: HTMLElement, onLogin: (s: Session, remember: boolean) => Promise<void>, initialError = ""): Screen {
  const user = h("input", { type: "text", autocomplete: "username", autocapitalize: "off", spellcheck: "false", maxlength: "32", required: true });
  const pass = h("input", { type: "password", autocomplete: "current-password", maxlength: "128", required: !ONLINE ? false : true });
  const remember = h("input", { type: "checkbox", checked: true });
  const err = h("p", { class: "err" }, initialError);
  const btn = h("button", { class: "btn primary block", type: "submit" }, "Vào Vực Sâu");
  try {
    const last = localStorage.getItem("fl.lastUser");
    if (last) user.value = last;
  } catch { /* ignore */ }

  const form = h("form", { class: "login-card" },
    h("h1", { class: "logo" }, "FantasyLand", h("small", null, "Vực Sâu Bách Tầng")),
    h("label", { class: "field" }, "Tên đăng nhập", user),
    h("label", { class: "field" }, "Mật khẩu", pass),
    h("label", { class: "check" }, remember, "Ghi nhớ đăng nhập trên thiết bị này"),
    err,
    btn,
    h("p", { class: "note" }, ONLINE
      ? "Tài khoản do quản trị viên cấp. Liên hệ người quản lý game nếu bạn chưa có tài khoản."
      : "⚠️ Chế độ offline (chưa cấu hình Supabase): nhập tên bất kỳ, dữ liệu lưu trên trình duyệt này."),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    btn.disabled = true;
    btn.textContent = "Đang đăng nhập…";
    try {
      const s = await login(user.value, pass.value);
      try { localStorage.setItem("fl.lastUser", s.username); } catch { /* ignore */ }
      if (remember.checked) cacheSession(s);
      await onLogin(s, remember.checked);
    } catch (ex) {
      err.textContent = errorText(ex);
      btn.disabled = false;
      btn.textContent = "Vào Vực Sâu";
    }
  });

  const el = h("div", { class: "screen login" }, form);
  root.append(el);
  setTimeout(() => (user.value ? pass : user).focus(), 50);
  return { destroy: () => el.remove() };
}
