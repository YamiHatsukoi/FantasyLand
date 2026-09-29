import { FLOOR1 } from "./floor1";
import { FLOOR2 } from "./floor2";
import { FLOOR3 } from "./floor3";
import { GENERIC_GUARDIAN, RANDOM_EVENTS } from "./generic";
import { INTRO } from "./intro";
import type { StoryEvent } from "./types";
import { WORLD_EVENTS } from "./world";

const all = [INTRO, ...FLOOR1, ...FLOOR2, ...FLOOR3, GENERIC_GUARDIAN, ...RANDOM_EVENTS, ...WORLD_EVENTS];
export const EVENTS: Record<string, StoryEvent> = Object.fromEntries(all.map((e) => [e.id, e]));
export { RANDOM_EVENTS };
