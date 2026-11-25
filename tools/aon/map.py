"""Builds the travel map of a translated book: places (from the sections' scene.place), roads
between them (from links joining sections at different places) and a layout of the places.

Usage: python3 -I map.py <book dir with vi/*.json> <out map.json> [anchors.json]

anchors.json (optional, hand-made per book):
  {"pin": {"place-id": [x, y]}, "group": {"inner-place": "map-place"}}
"pin" fixes landmarks (start, capital...) in 0..1 map coordinates so the geography reads right; the
rest is laid out around them by a force simulation. "group" folds rooms and streets into the map
place that holds them (a shop -> the city). Output holds no book text, only ids and coordinates.
"""
import glob, json, math, os, random, sys
from collections import Counter, defaultdict

W, H = 96, 72  # map size in tiles


def load(book):
    secs = {}
    for f in sorted(glob.glob(os.path.join(book, "vi", "*.json"))):
        for k, v in json.load(open(f, encoding="utf-8")).items():
            if k not in ("new_terms", "_meta"):
                secs[k] = v
    return secs


def links(s):
    out = [c["to"] for c in s.get("choices", [])] + [o["to"] for o in (s.get("random") or {}).get("out", [])]
    c = s.get("combat") or {}
    out += [x for x in (c.get("win"), (c.get("evade") or {}).get("to"), (c.get("maxRounds") or {}).get("to")) if x]
    return out


def main(book, out, anchors_path=None):
    secs = load(book)
    cfg = json.load(open(anchors_path)) if anchors_path and os.path.exists(anchors_path) else {}
    group = cfg.get("group", {})
    for s in secs.values():
        s["scene"]["room"] = s["scene"]["place"]
        s["scene"]["place"] = group.get(s["scene"]["place"], s["scene"]["place"])
    place_bg = defaultdict(Counter)
    sec_place = {}
    for sid, s in secs.items():
        p = s["scene"]["place"]
        sec_place[sid] = p
        place_bg[p][s["scene"]["bg"]] += 1
    edges = Counter()
    for sid, s in secs.items():
        a = sec_place[sid]
        for t in links(s):
            b = sec_place.get(t)
            if b and b != a:
                edges[tuple(sorted((a, b)))] += 1
    places = sorted(place_bg)
    anchors = cfg.get("pin", {})
    rnd = random.Random(1984)
    pos = {p: list(anchors[p]) if p in anchors else [rnd.random(), rnd.random()] for p in places}
    # order of first visit along the book (section number) pulls the story from start to end
    first = {}
    for sid in sorted(secs, key=int):
        first.setdefault(sec_place[sid], int(sid))
    nb = defaultdict(set)
    for a, b in edges:
        nb[a].add(b); nb[b].add(a)
    for it in range(600):
        t = 0.02 * (1 - it / 600) + 0.002
        force = {p: [0.0, 0.0] for p in places}
        for i, a in enumerate(places):
            for b in places[i + 1:]:
                dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
                d2 = dx * dx + dy * dy + 1e-4
                f = 0.0009 / d2
                force[a][0] += dx * f; force[a][1] += dy * f
                force[b][0] -= dx * f; force[b][1] -= dy * f
        for (a, b), w in edges.items():
            dx, dy = pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]
            d = math.hypot(dx, dy) + 1e-6
            f = (d - 0.09) * 0.5
            force[a][0] += dx / d * f; force[a][1] += dy / d * f
            force[b][0] -= dx / d * f; force[b][1] -= dy / d * f
        for p in places:
            if p in anchors:
                continue
            fx, fy = force[p]
            m = math.hypot(fx, fy)
            if m > t:
                fx, fy = fx / m * t, fy / m * t
            pos[p][0] = min(0.95, max(0.05, pos[p][0] + fx))
            pos[p][1] = min(0.93, max(0.07, pos[p][1] + fy))
    nodes = {}
    used = set()
    for p in places:
        x, y = round(pos[p][0] * (W - 1)), round(pos[p][1] * (H - 1))
        while (x, y) in used:
            x += 1
        used.add((x, y))
        nodes[p] = {"x": x, "y": y, "bg": place_bg[p].most_common(1)[0][0], "first": first.get(p, 0)}
    # draw fewer roads: a spanning tree of the story links (shortest first) plus the busiest links
    parent = {p: p for p in places}
    def root(p):
        while parent[p] != p:
            parent[p] = parent[parent[p]]; p = parent[p]
        return p
    dist = lambda e: math.hypot(nodes[e[0]]["x"] - nodes[e[1]]["x"], nodes[e[0]]["y"] - nodes[e[1]]["y"])
    roads = []
    for e in sorted(edges, key=dist):
        ra, rb = root(e[0]), root(e[1])
        if ra != rb:
            parent[ra] = rb; roads.append(e)
        elif edges[e] >= 4 and dist(e) < 30:
            roads.append(e)
    json.dump({"w": W, "h": H, "nodes": nodes, "edges": [[a, b] for (a, b) in roads], "group": group}, open(out, "w"), indent=1)
    print(f"{len(nodes)} places, {len(edges)} story links, {len(roads)} roads drawn")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
