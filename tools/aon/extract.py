"""Splits a Project Aon "simpler" XHTML book into raw JSON (English), for the translation step.

Usage: python3 -I extract.py <book.htm> <out.json>

The output holds book text, so it must NOT be committed to this public repository:
Project Aon's license allows personal copies only. Keep it outside the repo.
"""
import html, json, re, sys
from html.parser import HTMLParser


class Blocks(HTMLParser):
    """Flattens the body into a list of blocks: headings (with anchor id) and paragraphs/tables."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.cur, self.depth, self.anchor = [], None, 0, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and "id" in a:
            self.anchor = a["id"]
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "dd", "dt", "tr", "blockquote") and self.cur is None:
            self.cur = {"tag": tag, "cls": a.get("class", ""), "text": "", "links": []}
            self.depth = 0
            self.anchor = None
        if self.cur is not None:
            if tag == self.cur["tag"]:
                self.depth += 1
            if tag == "a" and a.get("href", "").startswith("#"):
                self.cur["links"].append(a["href"][1:])
            if tag in ("td", "th"):
                self.cur["text"] += " | "
            if tag == "br":
                self.cur["text"] += "\n"

    def handle_endtag(self, tag):
        if self.cur is not None and tag == self.cur["tag"]:
            self.depth -= 1
            if self.depth <= 0:
                c = self.cur
                c["text"] = re.sub(r"[ \t ]+", " ", c["text"]).strip()
                if c["tag"].startswith("h"):
                    c["id"] = self.anchor
                if c["text"]:
                    self.blocks.append(c)
                self.cur = None

    def handle_data(self, d):
        if self.cur is not None:
            self.cur["text"] += d


def main(src, out):
    raw = open(src, encoding="utf-8").read()
    p = Blocks()
    p.feed(raw)
    title = html.unescape(re.search(r"<title>(.*?)</title>", raw, re.S).group(1)).strip()
    front, sections, cur_front, cur_sect = {}, {}, None, None
    for b in p.blocks:
        if b["tag"] in ("h2", "h3", "h4"):
            hid = b.get("id") or ""
            m = re.fullmatch(r"sect(\d+)", hid)
            if m:
                cur_sect, cur_front = m.group(1), None
                sections[cur_sect] = []
                continue
            cur_sect = None
            if hid in ("license", "footnotz", "illstrat", "errata"):
                cur_front = None
                continue
            cur_front = hid or b["text"]
            front.setdefault(cur_front, {"title": b["text"], "blocks": []})
            continue
        if cur_sect is not None:
            kind = "choice" if "choice" in b["cls"] else "combat" if "combat" in b["cls"] else "deadend" if "deadend" in b["cls"] else "text"
            item = {"k": kind, "t": b["text"]}
            to = [l[4:] for l in b["links"] if re.fullmatch(r"sect\d+", l)]
            if to:
                item["to"] = to
            if kind == "combat":
                m = re.match(r"(.+?):\s*COMBAT\s*SKILL\s*(\d+)\s*ENDURANCE\s*(\d+)", b["text"].replace(" ", " "))
                if m:
                    item["foe"] = {"name": m.group(1).strip(), "cs": int(m.group(2)), "ep": int(m.group(3))}
            if "illustration" in b["links"] or b["tag"] == "dd":
                continue
            sections[cur_sect].append(item)
        elif cur_front is not None:
            front[cur_front]["blocks"].append(b["text"])
    json.dump({"title": title, "front": front, "sections": sections}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n_choice = sum(1 for s in sections.values() for i in s if i["k"] == "choice")
    n_combat = sum(1 for s in sections.values() for i in s if i["k"] == "combat")
    words = sum(len(i["t"].split()) for s in sections.values() for i in s)
    print(f"{title}: {len(sections)} sections, {n_choice} choices, {n_combat} combats, {words} words in sections")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
