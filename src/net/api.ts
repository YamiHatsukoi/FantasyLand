/**
 * Thin client for the Supabase RPC functions defined in supabase/0*.sql.
 * Without configuration the game runs in offline mode (saves in localStorage).
 */
const URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "").replace(/\/+$/, "");
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export const ONLINE = Boolean(URL && KEY);

export interface Session {
  token: string;
  username: string;
  offline?: boolean;
}

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

const SESSION_KEY = "fl.session";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { apikey: KEY, "Content-Type": "application/json" };
  if (KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${KEY}`;
  let res: Response;
  try {
    res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args), keepalive: fn === "game_save" });
  } catch {
    throw new ApiError("network", "Không kết nối được máy chủ.");
  }
  if (!res.ok) throw new ApiError(`http_${res.status}`, `Máy chủ trả lỗi ${res.status}.`);
  const data = (await res.json()) as T & { error?: string };
  if (data && typeof data === "object" && "error" in data && data.error) throw new ApiError(data.error);
  return data;
}

export async function login(username: string, password: string): Promise<Session> {
  const u = username.trim();
  if (!ONLINE) {
    if (u.length < 3) throw new ApiError("invalid_credentials");
    return { token: `offline:${u.toLowerCase()}`, username: u, offline: true };
  }
  const r = await rpc<{ token: string; username: string }>("game_login", { p_username: u, p_password: password });
  return { token: r.token, username: r.username };
}

export interface RemoteSave {
  username: string;
  data: unknown | null;
  version: number;
}

export async function loadSave(s: Session): Promise<RemoteSave> {
  if (s.offline) return { username: s.username, data: null, version: 0 };
  return rpc<RemoteSave>("game_load", { p_token: s.token });
}

export async function storeSave(s: Session, data: unknown, baseVersion: number, force = false): Promise<number> {
  if (s.offline) return baseVersion + 1;
  const r = await rpc<{ version: number }>("game_save", { p_token: s.token, p_data: data, p_base_version: baseVersion, p_force: force });
  return r.version;
}

export async function logout(s: Session): Promise<void> {
  clearSession();
  if (!s.offline) {
    try { await rpc("game_logout", { p_token: s.token }); } catch { /* ignore */ }
  }
}

export function cachedSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function cacheSession(s: Session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "invalid_credentials": return "Sai tên đăng nhập hoặc mật khẩu.";
      case "locked": return "Đăng nhập sai quá nhiều lần. Thử lại sau 5 phút.";
      case "invalid_session": return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      case "conflict": return "Dữ liệu đã được lưu từ một thiết bị khác.";
      case "too_large": return "Dữ liệu lưu quá lớn.";
      default: return e.message;
    }
  }
  return e instanceof Error ? e.message : String(e);
}
