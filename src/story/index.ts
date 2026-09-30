import { FLOOR1 } from "./floor1";
import { FLOOR2 } from "./floor2";
import { FLOOR3 } from "./floor3";
import { GENERIC_GUARDIAN, RANDOM_EVENTS } from "./generic";
import { INTRO } from "./intro";
import type { StoryEvent } from "./types";
import { WORLD_EVENTS } from "./world";

import { ROADSIDE, ROADSIDE_META, SECRET_WALL } from "./roadside";

/** Every roadside "?" encounter: the originals plus the big pool. */
const ALL_RANDOM = [...RANDOM_EVENTS, ...ROADSIDE];
const all = [INTRO, ...FLOOR1, ...FLOOR2, ...FLOOR3, GENERIC_GUARDIAN, SECRET_WALL, ...ALL_RANDOM, ...WORLD_EVENTS];
export const EVENTS: Record<string, StoryEvent> = Object.fromEntries(all.map((e) => [e.id, e]));
export { RANDOM_EVENTS, ROADSIDE_META };
export const RANDOM_POOL = ALL_RANDOM.map((e) => ({ id: e.id, rare: !!ROADSIDE_META[e.id]?.rare || e.id === "g_merchant" }));
