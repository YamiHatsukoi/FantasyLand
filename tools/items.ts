import { ITEM_LIST, getItem } from "../src/data/items";
import { RECIPES } from "../src/data/recipes";
const by: Record<string, number> = {};
for (const i of ITEM_LIST) by[i.type] = (by[i.type] ?? 0) + 1;
console.log("items", ITEM_LIST.length, by, "recipes", RECIPES.length);
const names = new Map<string, string>();
for (const i of ITEM_LIST) { if (names.has(i.name)) console.log("dup name", i.name, i.id, names.get(i.name)); names.set(i.name, i.id); }
const uncraftable = ITEM_LIST.filter((i) => i.type === "equip" && !RECIPES.some((r) => r.out === i.id)).map((i) => i.id);
console.log("equip without recipe", uncraftable.length, uncraftable.slice(0, 20).join(","));
console.log(getItem("sword_t12"));
