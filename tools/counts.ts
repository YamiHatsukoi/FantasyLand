import { SKILLS, PLAYER_SKILLS } from "../src/data/skills";
import { PASSIVES, PLAYER_PASSIVES } from "../src/data/passives";
import { STATUSES } from "../src/combat/statuses";
import { RECIPES } from "../src/data/recipes";
import { ITEMS } from "../src/data/items";
import { EVENTS } from "../src/story";
console.log({ skills: Object.keys(SKILLS).length, playerSkills: PLAYER_SKILLS.length, passives: Object.keys(PASSIVES).length, playerPassives: PLAYER_PASSIVES.length, statuses: Object.keys(STATUSES).length, recipes: RECIPES.length, equips: Object.values(ITEMS).filter(i => i.type === "equip").length, events: Object.keys(EVENTS).length, floorEvents: Object.keys(EVENTS).filter(k => /^f[123]_/.test(k)).length });
