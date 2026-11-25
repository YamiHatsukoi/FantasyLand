/**
 * The director's text beats: a section's text cut into short pieces (1–2 sentences) must keep
 * every word, in order, and never cut a quotation in two.
 */
import { describe, expect, it } from "vitest";
import { chunkText } from "../src/adventure/director";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("director beats", () => {
  it("keeps all of the text, in order", () => {
    const text = [
      "Bạn lao qua những hàng cây ngày càng dày. Tiếng la hét xa dần phía sau! Bạn dừng lại thở dốc… Rồi bạn đi tiếp?",
      "Một người đàn ông bước ra và nói: “Dừng lại! Ai đó? Không ai được qua cầu này.” Bạn đáp lại rằng bạn là Kai Lord.",
      "Câu cuối không có dấu chấm",
    ];
    const chunks = chunkText(text);
    expect(squash(chunks.join(" "))).toBe(squash(text.join(" ")));
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(260);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks[0]).toBe("Bạn lao qua những hàng cây ngày càng dày. Tiếng la hét xa dần phía sau! Bạn dừng lại thở dốc…");
  });

  it("keeps a quotation in one beat", () => {
    const chunks = chunkText(["Ông ta nói: “Dừng lại! Ai đó? Không ai được qua.” Bạn im lặng."]);
    const q = chunks.find((c) => c.includes("“"));
    expect(q).toBeDefined();
    expect(q).toContain("”");
  });

  it("never merges two paragraphs", () => {
    const chunks = chunkText(["Một.", "Hai."]);
    expect(chunks).toEqual(["Một.", "Hai."]);
  });
});
