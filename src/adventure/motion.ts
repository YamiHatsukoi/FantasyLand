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

