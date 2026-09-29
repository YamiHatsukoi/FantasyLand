import type { GameState } from "./core/state";
import type { Session } from "./net/api";
import type { SaveManager } from "./net/save";

export interface Screen {
  destroy(): void;
}

class App {
  root!: HTMLElement;
  session: Session | null = null;
  saver: SaveManager | null = null;
  screen: Screen | null = null;
  /** Called by the shell when the save status changes (HUD indicator). */
  statusListeners = new Set<(s: string) => void>();

  get game(): GameState {
    const g = this.saver?.game;
    if (!g) throw new Error("No game loaded");
    return g;
  }

  set game(g: GameState) {
    if (!this.saver) throw new Error("No save manager");
    this.saver.game = g;
  }

  show(factory: (root: HTMLElement) => Screen) {
    this.screen?.destroy();
    this.root.replaceChildren();
    this.screen = factory(this.root);
  }

  /** Persist after a state change. `immediate` for important moments (sleep, floor change...). */
  dirty(immediate = false) {
    this.saver?.markDirty(immediate);
  }
}

export const app = new App();
