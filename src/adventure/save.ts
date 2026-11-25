/**
 * Save slots of one book: written to this device at once, synced to Supabase
 * (adv_* functions, supabase/06_adventure.sql) shortly after. Offline sessions keep local copies only.
 */
import { ApiError, advDelete, advLoad, advSave, type Session } from "../net/api";
import type { AdvState } from "./types";

export const SLOTS = 3;

interface Local {
  version: number;
  synced: boolean;
  data: AdvState;
}

export interface SlotInfo {
  slot: number;
  data: AdvState | null;
}

export class AdvSaves {
  private versions = new Map<number, number>();
  private timers = new Map<number, number>();
  private latest = new Map<number, AdvState>();
  onError?: (e: unknown) => void;

  constructor(public session: Session, public book: string) {}

  private key(slot: number) {
    return `adv.${this.session.username.toLowerCase()}.${this.book}.${slot}`;
  }

  private readLocal(slot: number): Local | null {
    try {
      const raw = localStorage.getItem(this.key(slot));
      return raw ? (JSON.parse(raw) as Local) : null;
    } catch {
      return null;
    }
  }

  private writeLocal(slot: number, l: Local) {
    try { localStorage.setItem(this.key(slot), JSON.stringify(l)); } catch { /* quota / private mode */ }
  }

  /** Newest copy of each slot: an unsynced local copy wins over the server's. */
  async list(): Promise<SlotInfo[]> {
    const remote = new Map<number, { data: AdvState | null; version: number }>();
    if (!this.session.offline) {
      try {
        for (const r of await advLoad(this.session, this.book)) remote.set(r.slot, { data: r.data as AdvState | null, version: r.version });
      } catch (e) {
        if (e instanceof ApiError && e.code === "invalid_session") throw e;
        this.onError?.(e); // network trouble: local copies only
      }
    }
    const out: SlotInfo[] = [];
    for (let slot = 0; slot < SLOTS; slot++) {
      const local = this.readLocal(slot);
      const r = remote.get(slot);
      let data: AdvState | null = null;
      if (local && (!local.synced || !r) && (!r || local.version >= r.version)) {
        data = local.data;
        this.versions.set(slot, local.version);
        if (!local.synced && !this.session.offline) this.save(slot, data);
      } else if (r) {
        data = r.data && (r.data as { wiped?: boolean }).wiped ? null : r.data;
        this.versions.set(slot, r.version);
        if (data) this.writeLocal(slot, { version: r.version, synced: true, data });
      }
      out.push({ slot, data });
    }
    return out;
  }

  /** What this device holds for each slot, at once (no network): for badges and quick looks. */
  peek(): (AdvState | null)[] {
    const out: (AdvState | null)[] = [];
    for (let slot = 0; slot < SLOTS; slot++) out.push(this.readLocal(slot)?.data ?? null);
    return out;
  }

  /** Call after every change; the server copy follows within a couple of seconds. */
  save(slot: number, data: AdvState, now = false) {
    const v = this.versions.get(slot) ?? 0;
    this.latest.set(slot, data);
    if (this.session.offline) {
      this.versions.set(slot, v + 1);
      this.writeLocal(slot, { version: v + 1, synced: true, data });
      return;
    }
    this.writeLocal(slot, { version: v, synced: false, data });
    window.clearTimeout(this.timers.get(slot));
    this.timers.set(slot, window.setTimeout(() => void this.push(slot), now ? 50 : 2500));
  }

  /** Sends all pending slots now (leaving the game, closing the tab). */
  async flush() {
    await Promise.all([...this.timers.keys()].map((slot) => this.push(slot)));
  }

  private async push(slot: number, force = false): Promise<void> {
    window.clearTimeout(this.timers.get(slot));
    this.timers.delete(slot);
    const data = this.latest.get(slot);
    if (!data || this.session.offline) return;
    try {
      const v = await advSave(this.session, this.book, slot, data, this.versions.get(slot) ?? 0, force);
      this.versions.set(slot, v);
      if (this.latest.get(slot) === data) this.writeLocal(slot, { version: v, synced: true, data });
    } catch (e) {
      // saved meanwhile on another device: the copy played most recently wins
      if (e instanceof ApiError && e.code === "conflict" && !force) return this.push(slot, true);
      this.onError?.(e);
      this.timers.set(slot, window.setTimeout(() => void this.push(slot), 20000));
    }
  }

  async remove(slot: number) {
    window.clearTimeout(this.timers.get(slot));
    this.timers.delete(slot);
    this.latest.delete(slot);
    try { localStorage.removeItem(this.key(slot)); } catch { /* ignore */ }
    this.versions.delete(slot);
    if (!this.session.offline) await advDelete(this.session, this.book, slot);
  }
}
