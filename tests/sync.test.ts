import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stored: unknown[] = [];
vi.mock("../src/net/api", () => ({
  ApiError: class extends Error { constructor(public code: string) { super(code); } },
  loadSave: vi.fn(),
  storeSave: vi.fn(async (_s: unknown, data: unknown) => { stored.push(data); return stored.length; }),
}));

import { SaveManager } from "../src/net/save";
import { newGame } from "../src/core/state";

describe("server sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const mem = new Map<string, string>();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    stored.length = 0;
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("still reaches the server while the player keeps changing things", async () => {
    const sv = new SaveManager({ token: "t", username: "a" }, newGame("A", "warrior", 1));
    // a step every second for half a minute: the old quiet-period timer never fired
    for (let i = 0; i < 30; i++) { sv.markDirty(); await vi.advanceTimersByTimeAsync(1000); }
    expect(stored.length).toBeGreaterThanOrEqual(3);
  });

  it("an important moment is not delayed by an earlier ordinary change", async () => {
    const sv = new SaveManager({ token: "t", username: "a" }, newGame("A", "warrior", 1));
    sv.markDirty();
    sv.markDirty(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(stored.length).toBe(1);
    expect(sv.status).toBe("saved");
  });
});
