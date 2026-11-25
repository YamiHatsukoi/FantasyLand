/**
 * View settings of Adventure kept on this device: how close the scene is framed, and the
 * "Giảm rung màn hình" setting (no screen shake, no zoom punches).
 */

/** "full": the whole width of the scene (letterboxed above/below); "near": cover-cropped, closer. */
export type ViewZoom = "full" | "near";
const ZOOM_KEY = "adv.zoom", CALM_KEY = "adv.calm";
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function viewZoom(): ViewZoom { return lsGet(ZOOM_KEY) === "near" ? "near" : "full"; }
export function setViewZoom(z: ViewZoom) {
  lsSet(ZOOM_KEY, z);
  window.dispatchEvent(new CustomEvent("adv-zoom", { detail: z }));
}
export const zoomLabel = (z: ViewZoom) => (z === "full" ? "Toàn cảnh" : "Cận");

/** The player's "Giảm rung màn hình" setting (on unless turned off). */
export const calmSetting = () => lsGet(CALM_KEY) !== "0";
export const setCalmSetting = (on: boolean) => lsSet(CALM_KEY, on ? "1" : "0");
/** No screen shake and no zoom punches: the setting, or the system's reduced motion. */
export const calmMotion = () => calmSetting() || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);


/**
 * Frame pacing for the drawing loops (stage, battle, explore): a device that cannot keep up
 * 60 fps draws every other frame instead, a steady 30 rather than a stutter; it tries 60
 * again every few seconds once frames come back on time.
 */
export class Pacer {
  /** Share of recent frames that came late (running average). */
  private slow = 0;
  private prev = 0;
  private n = 0;
  private half = false;
  private odd = false;
  private since = 0;
  /** Call on each animation frame: false when this one should not be drawn. */
  tick(t: number): boolean {
    if (this.prev) {
      this.slow += ((t - this.prev > 21 ? 1 : 0) - this.slow) * 0.05;
      this.n++;
    }
    this.prev = t;
    if (!this.half) {
      if (this.n > 60 && this.slow > 0.5) { this.half = true; this.since = t; }
    } else if (t - this.since > 3000 && this.slow < 0.12) { this.half = false; this.n = 0; }
    const hook = (globalThis as { __advDraw?: (t: number, half: boolean) => void }).__advDraw;
    if (!this.half) { hook?.(t, false); return true; }
    this.odd = !this.odd;
    if (!this.odd) hook?.(t, true);
    return !this.odd;
  }
  /** After a pause (hidden, covered): the gap is not a slow frame. */
  reset() { this.prev = 0; }
}
