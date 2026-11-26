/** FORMAT v15 rules (book 9 encodings) on a made-up book: no book text in this repository. */
import { describe, expect, it } from "vitest";
import {
  apply, check, choiceState, condText, confiscate, enter, epMax, heroCs, listEntries, newRun, offerOpen, openChoicePick, playRound, startBattle, takeOffer, visibleChoices,
} from "../src/adventure/engine";
import { Director, synthBeats } from "../src/adventure/director";
import type { AdvState, Book, Choice, Combat, CRT, Section } from "../src/adventure/types";

const crt: CRT = Array.from({ length: 10 }, () => Array.from({ length: 13 }, (_, c) => [c === 12 ? -1 : 3 + c, c === 0 ? -1 : 3] as [number, number]));
const scene = { place: "p", bg: "forest" as const, time: "day" as const, weather: "clear" as const, actors: [], mood: "calm" as const };
/** A random source returning these values in turn (then the last one). */
const seq = (...v: number[]) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

const book: Book = {
  id: "v15", series: "lw", num: 9, rules: "magnakai", title: "Thử", intro: [], start: "1", crt, weaponskill: ["Sword", "Bow", "Axe"], discCount: 3,
  kit: { items: [], gold: { random: false, add: 10 }, picks: [] },
  items: {
    Sword: { name: "Kiếm", type: "weapon" }, Axe: { name: "Rìu", type: "weapon" },
    Map: { name: "Bản đồ", type: "special" }, Ring: { name: "Nhẫn", type: "special", keep: true }, Helmet: { name: "Mũ", type: "special", epMax: 2 },
    Quiver: { name: "Ống tên", type: "special" }, Rope: { name: "Dây", type: "backpack" }, Torch: { name: "Đuốc", type: "backpack" },
    Bowl: { name: "Bát Bạc", type: "backpack" }, Cloth: { name: "Khăn", type: "backpack" }, Dust: { name: "Bụi Vàng", type: "backpack" },
  },
  names: { disc: { weaponmastery: "WM", animalcontrol: "AC", curing: "Cur", invisibility: "Inv", huntmastery: "Hunt", pathsmanship: "Path", psisurge: "Psi-surge", psiscreen: "Psi-screen", nexus: "Nexus", divination: "Div" } as Book["names"]["disc"] },
  sections: {
    "1": { text: ["a"], scene, choices: [{ text: "Đi", to: "2" }] },
    "2": { text: ["b"], scene, end: "victory" },
  },
};

const mk = (): AdvState => {
  const s = newRun(book, { name: "LW", csRoll: 5, epRoll: 5, disciplines: ["huntmastery", "nexus", "divination"], picks: [] });
  s.weapons = ["Sword", "Axe"];
  s.special = ["Map", "Ring", "Helmet", "Quiver"];
  s.backpack = ["Rope", "Torch", "Bowl"];
  s.meals = 2;
  s.arrows = 4;
  return s;
};

describe("v15: positional item loss (loseNth)", () => {
  it("loses the n-th item of the list, keep items not counted", () => {
    const s = mk();
    // Special list without the keep Ring: Map, Helmet, Quiver
    expect(listEntries(book, s, "special").map((x) => x.id)).toEqual(["Map", "Helmet", "Quiver"]);
    const ch = apply(book, s, [{ loseNth: { kind: "special", n: 2 } }]);
    expect(s.special).toEqual(["Map", "Ring", "Quiver"]);
    expect(ch.map((c) => c.label)).toEqual(["Mất Mũ"]);
  });

  it("Backpack positions: items first, then the Meals; third and fourth = n 4 then n 3", () => {
    const s = mk();
    expect(listEntries(book, s, "backpack").map((x) => x.id)).toEqual(["Rope", "Torch", "Bowl", "Meal", "Meal"]);
    apply(book, s, [{ loseNth: { kind: "backpack", n: 4 } }, { loseNth: { kind: "backpack", n: 3 } }]);
    expect(s.backpack).toEqual(["Rope", "Torch"]);
    expect(s.meals).toBe(1);
  });

  it("falls back through else: the last one, then the first Backpack Item", () => {
    const fx = [{ loseNth: { kind: "special" as const, n: 2, else: [{ kind: "special" as const, n: "last" as const }, { kind: "backpack" as const, n: 1 }] } }];
    const s = mk();
    s.special = ["Map"];
    apply(book, s, fx);
    expect(s.special).toEqual([]);
    expect(s.backpack).toEqual(["Rope", "Torch", "Bowl"]);
    apply(book, s, fx);
    expect(s.backpack).toEqual(["Torch", "Bowl"]);
    s.backpack = []; s.meals = 0;
    expect(apply(book, s, fx)).toEqual([]); // nothing left to lose: no change, no crash
  });

  it("losing the Quiver loses the Arrows, losing the Helmet its ENDURANCE", () => {
    const s = mk();
    s.ep = epMax(book, s);
    const ep = s.ep;
    apply(book, s, [{ loseNth: { kind: "special", n: "last" } }]);
    expect(s.special).not.toContain("Quiver");
    expect(s.arrows).toBe(0);
    apply(book, s, [{ loseNth: { kind: "special", n: 2 } }]);
    expect(s.special).toEqual(["Map", "Ring"]);
    expect(s.ep).toBe(ep - 2);
  });

  it("weapons by position", () => {
    const s = mk();
    apply(book, s, [{ loseNth: { kind: "weapon", n: 1 } }]);
    expect(s.weapons).toEqual(["Axe"]);
  });
});

describe("v15: random item loss", () => {
  it("loseRandom loses n distinct items picked by the random source", () => {
    const s = mk();
    // pool Map, Helmet, Quiver: 0.5 → Helmet; then of Map, Quiver: 0 → Map
    const ch = apply(book, s, [{ loseRandom: { kind: "special", n: 2 } }], seq(0.5, 0));
    expect(s.special).toEqual(["Ring", "Quiver"]);
    expect(ch).toHaveLength(2);
    // more than there is: everything that can go goes
    apply(book, s, [{ loseRandom: { kind: "special", n: 5 } }], seq(0.99));
    expect(s.special).toEqual(["Ring"]);
  });

  it("loseHalf rounds down (Meals count), up with up: true", () => {
    const s = mk(); // 3 items + 2 Meals = 5
    apply(book, s, [{ loseHalf: "backpack" }], seq(0));
    expect(s.backpack.length + s.meals).toBe(3);
    expect(s.backpack).toEqual(["Bowl"]); // the first two picked each time
    const t = mk();
    apply(book, t, [{ loseHalf: "backpack", up: true }], seq(0.99));
    expect(t.backpack.length + t.meals).toBe(2);
    expect(t.meals).toBe(0);
  });
});

describe("v15: Arrows below, Lune", () => {
  it("arrowsBelow is a negative condition (the choice hides)", () => {
    const s = mk();
    expect(check(s, { arrowsBelow: 5 })).toBe(true);
    expect(check(s, { arrowsBelow: 4 })).toBe(false);
    expect(choiceState(s, { if: { arrowsBelow: 2 } })).toBe("hidden");
  });

  it("Lune are counted apart from Gold Crowns, never converted", () => {
    const s = mk();
    expect(s.lune ?? 0).toBe(0);
    expect(check(s, { luneBelow: 1 })).toBe(true);
    const ch = apply(book, s, [{ lune: 28 }]);
    expect(s.lune).toBe(28);
    expect(s.gold).toBe(10);
    expect(ch[0].label).toBe("+28 Lune");
    expect(check(s, { lune: 10 })).toBe(true);
    expect(check(s, { lune: 29 })).toBe(false);
    expect(choiceState(s, { if: { lune: 29 } })).toBe("locked");
    expect(condText(book, { lune: 29 })).toBe("cần 29 Lune");
    expect(choiceState(s, { if: { luneBelow: 10 } })).toBe("hidden");
    apply(book, s, [{ lune: -40 }]);
    expect(s.lune).toBe(0);
    // "you may take 28 Lune"
    apply(book, s, [{ lune: 28, optional: true }]);
    expect(s.lune).toBe(0);
    takeOffer(book, s, 0);
    expect(s.lune).toBe(28);
  });

  it("Lune go with the gold when it is confiscated, and come back", () => {
    const s = mk();
    s.lune = 12;
    apply(book, s, [{ stash: "jail", only: ["gold"] }]);
    expect(s.lune).toBe(0);
    expect(s.stashes?.jail.lune).toBe(12);
    apply(book, s, [{ unstash: "jail" }]);
    expect(s.lune).toBe(12);
    expect(confiscate(book, s, ["weapons"], false).lune).toBeUndefined();
    apply(book, s, [{ loseAll: "lune" }]);
    expect(s.lune).toBe(0);
  });
});

describe("v15: pick limit", () => {
  const loot = [{ gain: "Bowl", type: "backpack" as const }, { gain: "Cloth", type: "backpack" as const }, { gain: "Dust", type: "backpack" as const }, { lune: 5 }];

  it("section pick: at most max of the offered items, the rest closes", () => {
    book.sections["5"] = { text: ["k"], scene, pick: { max: 2, from: loot }, choices: [{ text: "Đi", to: "2" }] };
    const s = mk();
    s.backpack = [];
    enter(book, s, "5");
    expect(s.offers).toHaveLength(4);
    expect(s.pickLeft).toEqual({ sec: 2 });
    takeOffer(book, s, 1); // Cloth
    expect(s.pickLeft!.sec).toBe(1);
    takeOffer(book, s, s.offers.findIndex((o) => "lune" in o));
    expect(s.lune).toBe(5);
    expect(s.pickLeft!.sec).toBe(0);
    expect(s.offers.every((o) => !offerOpen(s, o))).toBe(true);
    expect(takeOffer(book, s, 0)).toEqual([]);
    expect(s.backpack).toEqual(["Cloth"]);
    // the next section starts afresh
    enter(book, s, "1");
    expect(s.pickLeft).toBeUndefined();
    expect(s.offers).toEqual([]);
  });

  it("a partly taken offer counts once", () => {
    book.sections["6"] = { text: ["k"], scene, pick: { max: 1, from: [{ gain: "Meal", type: "meal", n: 3 }, { gain: "Rope", type: "backpack" }] }, choices: [{ text: "Đi", to: "2" }] };
    const s = mk();
    s.backpack = ["Rope", "Torch", "Bowl", "Cloth", "Dust"]; s.meals = 2; // one free slot
    enter(book, s, "6");
    takeOffer(book, s, 0);
    expect(s.meals).toBe(3);
    expect(s.pickLeft!.sec).toBe(0);
    expect(offerOpen(s, s.offers[0])).toBe(true); // the rest of the Meals may still be taken
    expect(offerOpen(s, s.offers[1])).toBe(false);
  });

  it("choice pickMax: offered where the choice leads, or once in place with repeat", () => {
    const go: Choice = { text: "Chọn phần thưởng", to: "2", pickMax: { n: 1, items: loot } };
    const s = mk();
    enter(book, s, "1");
    openChoicePick(s, go);
    expect(s.pickLeft).toEqual({ "c:Chọn phần thưởng": 1 });
    expect(s.offers).toHaveLength(4);
    const stay: Choice = { text: "Lục rương", to: "7", repeat: true, pickMax: { n: 2, items: loot } };
    const sec: Section = { text: ["r"], scene, choices: [stay, { text: "Đi", to: "2" }] };
    book.sections["7"] = sec;
    enter(book, s, "7");
    expect(visibleChoices(sec, s)).toHaveLength(2);
    openChoicePick(s, stay);
    expect(visibleChoices(sec, s).map((c) => c.text)).toEqual(["Đi"]);
  });
});

describe("v15: an ally joins the fight", () => {
  it("foes[].heroCs adds to the hero's COMBAT SKILL against that foe only", () => {
    const s = mk();
    const c: Combat = { foes: [{ name: "A", cs: 15, ep: 3 }, { name: "B", cs: 15, ep: 30, heroCs: 2 }] };
    book.sections["9"] = { text: ["f"], scene, combat: c };
    s.section = "9"; s.fought = false;
    const b = startBattle(book, s, book.sections["9"]);
    const first = heroCs(book, s, c, c.foes[0], b.mind, 0).total;
    const second = heroCs(book, s, c, c.foes[1], b.mind, 0);
    expect(second.total).toBe(first + 2);
    expect(second.parts.at(-1)).toEqual({ label: "Đồng minh", v: 2 });
    // the ratio of a round against the second foe counts it
    playRound(book, s, b, false, () => 0.51);
    expect(b.idx).toBe(1);
    const r = playRound(book, s, b, false, () => 0.51);
    expect(r.ratio).toBe(second.total - 15);
  });
});

describe("v15: frost and unknown stage effects", () => {
  /** A stage that records what is drawn (no canvas needed). */
  const fakeStage = () => {
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => (k === "createRadialGradient" ? () => ({ addColorStop: () => undefined }) : () => { calls.push(String(k)); }), set: () => true }) as unknown as CanvasRenderingContext2D;
    const st = {
      now: 0, overlays: [] as ((g: CanvasRenderingContext2D, t: number) => boolean)[], particles: [] as unknown[], emitters: [] as unknown[], decals: [] as unknown[], actors: [],
      look: { fade: 0, dark: 0, glow: 0 }, cam: { x: 0, y: 0, zoom: 1 }, spec: scene,
      scene: { slots: Array.from({ length: 6 }, (_, i) => ({ x: 40 + i * 50, y: 150 })) },
      emit(e: unknown) { this.emitters.push(e); }, flash() { /* */ }, shake() { /* */ }, burst() { calls.push("burst"); }, decal() { /* */ },
      tween: () => Promise.resolve(), play() { /* */ }, stopEmitter() { /* */ },
    };
    return { st, g, calls };
  };
  const sec: Section = { text: ["Băng giá phủ kín mọi thứ."], scene };

  it("the auto director frosts icy text", () => {
    const frosty = (text: string) => synthBeats(book, { text: [text], scene }).flatMap((b) => b.do ?? []).some((a) => a.fx === "frost");
    expect(frosty(sec.text[0])).toBe(true);
    expect(frosty("Mặt hồ đã đóng băng.")).toBe(true);
    expect(frosty("Giá cả ở chợ rất đắt.")).toBe(false);
  });

  it("frost draws a tint and crystals and ends; unknown words never crash", () => {
    const { st, g, calls } = fakeStage();
    const d = new Director(st as never, book, sec, {} as never);
    const act = (a: object) => (d as unknown as { act: (a: object, e: unknown[]) => unknown }).act(a, []);
    act({ fx: "frost", at: "all" });
    expect(st.overlays).toHaveLength(1);
    expect(st.emitters).toHaveLength(1);
    expect(st.overlays[0](g, 2000)).toBe(true);
    expect(calls).toContain("fillRect");
    expect(calls).toContain("stroke");
    expect(st.overlays[0](g, 6000)).toBe(false);
    for (const w of ["no-such-effect", "", "FROST", "💥"]) expect(() => act({ fx: w, at: 3 })).not.toThrow();
    expect(calls).toContain("burst");
    expect(() => act({ fx: "frost", at: "nobody" })).not.toThrow();
  });
});
