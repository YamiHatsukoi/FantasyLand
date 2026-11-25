/**
 * The book's world: which location (book.locations) a section happens at, which world-map place
 * holds it, and what the walkable view needs to build the location (the ways out of it, where the
 * hero comes from, the locations each choice leads to). Books without locations fall back to the
 * scene's place, as before.
 */
import type { Book, Choice, Loc } from "./types";
import { mapPlace } from "./worldmap";

type Side = "north" | "south" | "east" | "west";
type Spot = { key: number; label: string; via: NonNullable<Choice["via"]>; locked?: string; toLoc?: string };

/** The location of a section (null when the book has none for it). */
export function sectionLoc(book: Book, sid: string): { id: string; loc: Loc } | null {
  const id = book.sections[sid]?.scene.loc;
  const loc = id ? book.locations?.[id] : undefined;
  return id && loc ? { id, loc } : null;
}

/** World-map place of a section: its location's node, else its scene's place (folded into map places). */
export function nodeOf(book: Book, sid: string): string {
  const sec = book.sections[sid];
  if (!sec) return "";
  const l = sectionLoc(book, sid);
  const place = l?.loc.node && (!book.map || book.map.nodes[mapPlace(book.map, l.loc.node)]) ? l.loc.node : sec.scene.place;
  return book.map ? mapPlace(book.map, place) : place;
}

/** A compass direction a choice's words name ("đi về phía nam"...), as explore reads it. */
export function saidSide(text: string): Side | undefined {
  const t = text.toLowerCase();
  for (const [side, w] of [["north", "bắc"], ["south", "nam"], ["east", "đông"], ["west", "tây"]] as const)
    if (new RegExp(`(phía|hướng|lối|nhánh|ngả|mạn) ${w}(?![\\p{L}])`, "u").test(t)) return side;
  return undefined;
}

const sidesCache = new WeakMap<Book, Map<string, Side[]>>();
/** Every side a section at the location leaves by (its links and the choices' `via.exit`). */
export function locSides(book: Book, locId: string): Side[] {
  let m = sidesCache.get(book);
  if (!m) {
    m = new Map();
    const acc = new Map<string, Set<Side>>();
    for (const sec of Object.values(book.sections)) {
      const id = sec.scene.loc;
      if (!id) continue;
      for (const c of sec.choices ?? []) {
        let ex: Side | undefined = c.via?.exit;
        if (!ex) continue;
        // a choice that goes to a linked location leaves by that link's side, unless its words name another
        const to = book.sections[c.to]?.scene.loc;
        if (to && to !== id && book.locations?.[id]?.links[to]) { ex = saidSide(c.text); if (!ex) continue; }
        let s = acc.get(id);
        if (!s) acc.set(id, (s = new Set()));
        s.add(ex);
      }
    }
    for (const [k, v] of acc) m.set(k, [...v].sort());
    sidesCache.set(book, m);
  }
  return m.get(locId) ?? [];
}

/**
 * What explore needs to show a section at its location (spread into mountExplore's options):
 * the location, where the hero comes from, and each spot's destination location. Null when the
 * section has no location (the view then comes from the scene, as before).
 */
export function exploreLocOpts(book: Book, sid: string, fromSid: string | undefined, spots: Spot[], choices: Choice[]) {
  const here = sectionLoc(book, sid);
  if (!here) return null;
  const from = fromSid ? book.sections[fromSid]?.scene.loc : undefined;
  return {
    loc: here.loc,
    locId: here.id,
    fromLoc: from && from !== here.id ? from : undefined,
    locations: book.locations,
    locSides: locSides(book, here.id),
    spots: spots.map((s) => ({ ...s, toLoc: book.sections[choices[s.key]?.to]?.scene.loc })),
  };
}
