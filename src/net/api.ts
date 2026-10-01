/**
 * Thin client for the Supabase RPC functions defined in supabase/0*.sql.
 * Without configuration the game runs in offline mode (saves in localStorage).
 */
// Accept the project URL with or without a trailing "/rest/v1" or slash.
const URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
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
  if (!res.ok) throw new ApiError(`http_${res.status}`, await describeHttpError(res, fn));
  const data = (await res.json()) as T & { error?: string };
  if (data && typeof data === "object" && "error" in data && data.error) throw new ApiError(data.error);
  return data;
}

/** Turns a PostgREST error response into an actionable Vietnamese message. */
async function describeHttpError(res: Response, fn: string): Promise<string> {
  let body: { code?: string; message?: string; hint?: string } = {};
  try { body = (await res.json()) as typeof body; } catch { /* not JSON */ }
  if (body.code === "PGRST202" || (res.status === 404 && body.message?.includes("function"))) {
    return `Supabase chưa có hàm ${fn}. Hãy chạy lại các file trong thư mục supabase/ (SQL Editor), sau đó chạy: notify pgrst, 'reload schema';`;
  }
  if (res.status === 404) return "Máy chủ trả lỗi 404: SUPABASE_URL có vẻ sai (cần dạng https://xxxx.supabase.co).";
  if (res.status === 401 || res.status === 403) return `Máy chủ từ chối truy cập (${res.status}): kiểm tra SUPABASE_ANON_KEY và quyền execute của hàm ${fn}.`;
  return `Máy chủ trả lỗi ${res.status}${body.message ? `: ${body.message}` : "."}`;
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

// ------------------------------------------------------------ other players (read only)
export interface PublicChar {
  id: string;
  name: string;
  classId: string;
  sprite: string;
  level: number;
  pal?: Record<string, string>;
  gear?: Record<string, string>;
  enh?: Record<string, number>;
  bond?: string;
}

export interface PlayerSummary {
  username: string;
  updated_at: string;
  hero: PublicChar | null;
  max_floor: number;
  day: number;
  territory: number;
  buildings: number;
  rank: number;
}

export interface VisitBuilding {
  type: string;
  x: number;
  y: number;
  level: number;
  plot?: { soil: number; crop?: { id: string; growth: number; harvests: number; perfect: boolean } };
}

export interface PlayerVisit {
  username: string;
  /** Save version of that player (absent if the server SQL predates it). */
  v?: number;
  updated_at: string;
  heroId: string;
  party: (PublicChar | null)[];
  residents: number;
  day: number;
  maxFloor: number;
  territory: number;
  settlers: number;
  weather: string;
  stats: { battles?: number; kills?: number; deaths?: number; steps?: number; goldSpent?: number } | null;
  buildings: VisitBuilding[];
}

export async function listPlayers(s: Session): Promise<PlayerSummary[]> {
  if (s.offline) throw new ApiError("offline", "Đang chơi ngoại tuyến: cần máy chủ để xem người chơi khác.");
  return (await rpc<{ players: PlayerSummary[] }>("game_players", { p_token: s.token })).players ?? [];
}

export async function visitPlayer(s: Session, username: string): Promise<PlayerVisit> {
  if (s.offline) throw new ApiError("offline", "Đang chơi ngoại tuyến: cần máy chủ để sang thăm.");
  return rpc<PlayerVisit>("game_visit", { p_token: s.token, p_username: username });
}

// ------------------------------------------------------------ gifts between players
export interface Gift {
  id: number;
  sender: string;
  items: Record<string, number>;
  gold: number;
  note: string | null;
  created_at: string;
}

export interface SentGift {
  id: number;
  recipient: string;
  items: Record<string, number>;
  gold: number;
  note: string | null;
  created_at: string;
  claimed_at: string | null;
}

export interface GiftBox {
  inbox: Gift[];
  sent: SentGift[];
}

const needServer = () => new ApiError("offline", "Đang chơi ngoại tuyến: cần máy chủ để tặng quà.");

export async function sendGift(s: Session, to: string, items: Record<string, number>, gold: number, note: string): Promise<number> {
  if (s.offline) throw needServer();
  return (await rpc<{ id: number }>("game_gift_send", { p_token: s.token, p_to: to, p_items: items, p_gold: gold, p_note: note })).id;
}

export async function giftBox(s: Session): Promise<GiftBox> {
  if (s.offline) throw needServer();
  const r = await rpc<Partial<GiftBox>>("game_gift_inbox", { p_token: s.token });
  return { inbox: r.inbox ?? [], sent: r.sent ?? [] };
}

/** Marks gifts as received and returns their contents. `id` null takes every waiting gift. */
export async function claimGifts(s: Session, id: number | null): Promise<{ id: number; items: Record<string, number>; gold: number }[]> {
  if (s.offline) throw needServer();
  return (await rpc<{ gifts: { id: number; items: Record<string, number>; gold: number }[] }>("game_gift_claim", { p_token: s.token, p_id: id })).gifts ?? [];
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
      case "not_found": return "Không tìm thấy người chơi này.";
      case "self_gift": return "Không thể tự gửi quà cho chính mình.";
      case "bad_gift": return "Gói quà không hợp lệ (tối đa 8 loại vật phẩm).";
      case "rate_limited": return "Bạn gửi quà hơi nhiều, nghỉ tay một lát rồi gửi tiếp nhé.";
      case "inbox_full": return "Hòm quà của người này đã đầy (50 gói chưa nhận).";
      default: return e.message;
    }
  }
  return e instanceof Error ? e.message : String(e);
}
