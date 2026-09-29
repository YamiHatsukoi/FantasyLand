import { chooseAction } from "../src/combat/ai";
import { Battle } from "../src/combat/engine";
import { unitFromCharacter, unitFromEnemy } from "../src/combat/factory";
import { makeCharacter } from "../src/core/state";
const groups = [["forest_wolf", "forest_wolf"], ["moss_slime", "forest_wolf"], ["stone_boar"], ["giant_wasp", "giant_wasp"], ["sapling", "mushroomling"], ["moss_slime", "mushroomling", "moss_slime"]];
for (const cls of ["warrior", "mage", "ranger", "rogue", "cleric", "guardian"]) {
  const row: string[] = [];
  for (const grp of groups) {
    let w = 0, hp = 0;
    for (let r = 0; r < 100; r++) {
      const b = new Battle([unitFromCharacter(makeCharacter("hero", "H", cls, "x", 1))], grp.map((id, i) => unitFromEnemy(id, 1, i)), r + 7);
      for (let t = 0; t < 300; t++) { const u = b.nextTurn(); if (!u) break; b.act(u, chooseAction(b, u)); }
      if (b.outcome() === "win") { w++; hp += b.allies[0].hp / b.maxHp(b.allies[0]); }
    }
    row.push(`${(w / 100).toFixed(2)}/${w ? (hp / w).toFixed(2) : "-"}`);
  }
  console.log(cls.padEnd(9), row.join("  "));
}
