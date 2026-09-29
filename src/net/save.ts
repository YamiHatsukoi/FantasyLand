import { migrate, type GameState } from "../core/state";
import { ApiError, loadSave, storeSave, type Session } from "./api";

interface LocalCopy {
  version: number; // server version this copy is based on
  synced: boolean;
  data: GameState;
}

const localKey = (s: Session) => `fl.save.${s.username.toLowerCase()}`;

function readLocal(s: Session): LocalCopy | null {
  try {
    const raw = localStorage.getItem(localKey(s));
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}

function writeLocal(s: Session, c: LocalCopy) {
  try { localStorage.setItem(localKey(s), JSON.stringify(c)); } catch { /* quota / private mode */ }
}

export type SaveStatus = "saved" | "saving" | "dirty" | "offline" | "error" | "conflict" | "auth";

/**
 * Keeps the game state persisted: a local copy is written immediately on every change
 * (so nothing is lost on refresh / bad network), and the server copy is synced in the background.
 */
export class SaveManager {
  version = 0;
  status: SaveStatus = "saved";
  onStatus?: (s: SaveStatus) => void;
  private timer: number | undefined;
  private inflight: Promise<void> | null = null;
  private pending = false;

  constructor(public session: Session, public game: GameState | null = null) {}

  /** Loads the newest save (server vs unsynced local copy). */
  async load(): Promise<GameState | null> {
    const local = readLocal(this.session);
    if (this.session.offline) {
      this.version = local?.version ?? 0;
      this.game = local ? migrate(local.data) : null;
      this.setStatus("offline");
      return this.game;
    }
    const remote = await loadSave(this.session);
    this.version = remote.version;
    if (local && !local.synced && local.version >= remote.version) {
      // Unsynced progress from a previous session on this device: prefer it and push it.
      this.game = migrate(local.data);
      this.pending = true;
      void this.flush();
    } else if (remote.data) {
      this.game = migrate(remote.data);
      writeLocal(this.session, { version: this.version, synced: true, data: this.game });
    } else {
      this.game = local ? migrate(local.data) : null;
    }
    return this.game;
  }

  private setStatus(s: SaveStatus) {
    this.status = s;
    this.onStatus?.(s);
  }

  /** Call after any meaningful state change. */
  markDirty(immediate = false) {
    if (!this.game) return;
    this.game.updated = Date.now();
    writeLocal(this.session, { version: this.version, synced: false, data: this.game });
    this.pending = true;
    if (this.session.offline) {
      this.version++;
      writeLocal(this.session, { version: this.version, synced: true, data: this.game });
      this.pending = false;
      this.setStatus("offline");
      return;
    }
    this.setStatus("dirty");
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), immediate ? 50 : 8000);
  }

  async flush(force = false): Promise<void> {
    if (!this.game || this.session.offline) return;
    if (this.inflight) {
      await this.inflight;
      if (!this.pending) return;
    }
    if (!this.pending && !force) return;
    this.pending = false;
    const snapshot = JSON.parse(JSON.stringify(this.game)) as GameState;
    this.setStatus("saving");
    this.inflight = (async () => {
      try {
        this.version = await storeSave(this.session, snapshot, this.version, force);
        writeLocal(this.session, { version: this.version, synced: !this.pending, data: this.game! });
        this.setStatus(this.pending ? "dirty" : "saved");
      } catch (e) {
        this.pending = true;
        window.clearTimeout(this.timer);
        if (e instanceof ApiError && e.code === "conflict") {
          this.setStatus("conflict");
        } else if (e instanceof ApiError && e.code === "invalid_session") {
          this.setStatus("auth");
        } else {
          this.setStatus("error");
          this.timer = window.setTimeout(() => void this.flush(), 20000);
        }
        throw e;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight.catch(() => undefined);
  }

  /** Overwrites the server copy with this device's state (used after a conflict). */
  async forceSave() {
    this.pending = true;
    await this.flush(true);
  }

  clearLocal() {
    try { localStorage.removeItem(localKey(this.session)); } catch { /* ignore */ }
  }
}
