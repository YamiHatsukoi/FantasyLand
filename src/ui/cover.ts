/**
 * Full-screen scenes (conversations, story events) mostly hide the map; while one is up the
 * map is redrawn at a much lower rate so the phone spends its time on the scene instead.
 */
let covers = 0;

/** Marks a covering scene as open; call the returned function when it closes. */
export function cover(): () => void {
  covers++;
  let done = false;
  return () => { if (!done) { done = true; covers--; } };
}

export const covered = () => covers > 0;
