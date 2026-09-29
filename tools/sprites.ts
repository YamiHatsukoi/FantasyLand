import { SPRITES } from "../src/render/sprites";
const only = process.argv[2];
for (const [id, s] of Object.entries(SPRITES)) {
  if (only && !only.split(",").includes(id)) continue;
  const bad = s.rows.filter((r) => r.length !== 16).length;
  console.log(`== ${id} ${s.rows.length}x16 ${bad ? "BAD ROWS " + bad : ""}`);
  for (const r of s.rows) console.log("  " + [...r].map((c) => (c === "." ? "  " : c + c)).join(""));
}
