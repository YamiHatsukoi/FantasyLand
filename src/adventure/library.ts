/**
 * The player's imported books. A book package is their personal copy (Project Aon License):
 * stored in their own account (adv_books, readable only by them) and cached on this device
 * (IndexedDB) so it is downloaded once. Offline sessions keep books on the device only.
 */
import { ApiError, advBookDelete, advBookGet, advBookPut, advBooks, type Session } from "../net/api";
import { validateBook } from "./engine";
import type { Book } from "./types";

export interface BookEntry {
  id: string;
  title: string;
  num: number;
  updated_at: string;
  local: boolean;
}

const DB = "adventure";
const STORE = "books";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result as T | undefined);
      q.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}

async function idbPut(key: string, value: unknown) {
  try {
    const db = await idb();
    await new Promise<void>((res) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(value, key);
      t.oncomplete = () => res();
      t.onerror = () => res();
    });
  } catch { /* private mode: no cache */ }
}

async function idbDel(key: string) {
  try {
    const db = await idb();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch { /* ignore */ }
}

const userKey = (s: Session) => s.username.toLowerCase();
const indexKey = (s: Session) => `index:${userKey(s)}`;
const bookKey = (s: Session, id: string) => `book:${userKey(s)}:${id}`;

export async function listBooks(s: Session): Promise<BookEntry[]> {
  const local = (await idbGet<BookEntry[]>(indexKey(s))) ?? [];
  if (s.offline) return local;
  try {
    const remote = (await advBooks(s)).map((b) => ({ ...b, local: local.some((l) => l.id === b.id && l.updated_at === b.updated_at) }));
    await idbPut(indexKey(s), remote.map((b) => ({ ...b, local: b.local })));
    return remote;
  } catch (e) {
    if (e instanceof ApiError && e.code === "invalid_session") throw e;
    return local; // network trouble: what this device has
  }
}

export async function loadBook(s: Session, entry: BookEntry): Promise<Book> {
  const cached = await idbGet<{ updated_at: string; data: Book }>(bookKey(s, entry.id));
  if (cached && (s.offline || cached.updated_at === entry.updated_at)) return cached.data;
  const r = await advBookGet(s, entry.id);
  const data = r.data as Book;
  await idbPut(bookKey(s, entry.id), { updated_at: r.updated_at, data });
  return data;
}

/** Reads a package file chosen by the player, checks it, stores it in their account. */
export async function importBook(s: Session, file: File): Promise<BookEntry> {
  let book: Book;
  try { book = JSON.parse(await file.text()) as Book; } catch { throw new Error("File không phải gói sách hợp lệ (JSON lỗi)."); }
  return storeBook(s, book);
}

/** Checks a book package and stores it in the player's account (and on this device). */
export async function storeBook(s: Session, book: Book): Promise<BookEntry> {
  const errs = validateBook(book);
  if (errs.length) throw new Error(`Gói sách có lỗi: ${errs.slice(0, 3).join("; ")}${errs.length > 3 ? "…" : ""}`);
  const now = new Date().toISOString();
  if (!s.offline) await advBookPut(s, book.id, book.title, book.num, book);
  const list = s.offline ? ((await idbGet<BookEntry[]>(indexKey(s))) ?? []) : await advBooks(s).then((l) => l.map((b) => ({ ...b, local: false })));
  let entry = list.find((b) => b.id === book.id);
  if (!entry) { entry = { id: book.id, title: book.title, num: book.num, updated_at: now, local: true }; list.push(entry); }
  else if (s.offline) Object.assign(entry, { title: book.title, num: book.num, updated_at: now });
  await idbPut(bookKey(s, book.id), { updated_at: entry.updated_at, data: book });
  entry.local = true;
  await idbPut(indexKey(s), list.sort((a, b) => a.num - b.num));
  return entry;
}

export async function removeBook(s: Session, id: string) {
  if (!s.offline) await advBookDelete(s, id);
  await idbDel(bookKey(s, id));
  const list = ((await idbGet<BookEntry[]>(indexKey(s))) ?? []).filter((b) => b.id !== id);
  await idbPut(indexKey(s), list);
}

// ------------------------------------------------------------ book shelf on GitHub (private repo)
/*
 * The player's personal copies live in their own private GitHub repository. With a read-only
 * token of theirs (kept on this device only, never in the game's code), the library pulls every
 * package in dist/ and keeps it up to date: a new or changed book is stored in their account.
 */
const GH_REPO = "YamiHatsukoi/lonewolf-vi";
const GH_DIR = "dist";
const ghKey = (s: Session) => `adv.gh.${userKey(s)}`;

export interface ShelfLink {
  token: string;
  repo: string;
  /** Last synced blob sha per file, to download only what changed. */
  shas: Record<string, string>;
}

export function shelfLink(s: Session): ShelfLink | null {
  try {
    const raw = localStorage.getItem(ghKey(s));
    return raw ? (JSON.parse(raw) as ShelfLink) : null;
  } catch { return null; }
}

export function saveShelfLink(s: Session, link: ShelfLink | null) {
  try {
    if (link) localStorage.setItem(ghKey(s), JSON.stringify(link));
    else localStorage.removeItem(ghKey(s));
  } catch { /* storage unavailable */ }
}

async function gh(link: ShelfLink, path: string, raw = false) {
  const res = await fetch(`https://api.github.com/repos/${link.repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${link.token}`, Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Mã truy cập GitHub không đúng hoặc đã hết hạn.");
  if (res.status === 403 || res.status === 404) throw new Error(`Mã truy cập không đọc được kho ${link.repo} (cần quyền đọc Contents của kho này).`);
  if (!res.ok) throw new Error(`GitHub trả lỗi ${res.status}.`);
  return raw ? res.text() : res.json();
}

/** Pulls new or changed books from the shelf; returns the titles that were added/updated. */
export async function syncShelf(s: Session, onProgress?: (t: string) => void): Promise<string[]> {
  const link = shelfLink(s);
  if (!link) return [];
  const files = (await gh(link, GH_DIR)) as { name: string; path: string; sha: string; type: string }[];
  const done: string[] = [];
  for (const f of files.filter((x) => x.type === "file" && x.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name))) {
    if (link.shas[f.name] === f.sha) continue;
    onProgress?.(`Đang tải ${f.name}…`);
    const book = JSON.parse(await gh(link, f.path, true) as string) as Book;
    const e = await storeBook(s, book);
    link.shas[f.name] = f.sha;
    saveShelfLink(s, link);
    done.push(e.title);
  }
  return done;
}

export function newShelfLink(token: string): ShelfLink {
  return { token: token.trim(), repo: GH_REPO, shas: {} };
}
