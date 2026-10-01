import { covered } from "../ui/cover";
/** Canvas camera + input for tile maps (dungeon floors and the safe zone). */
export class MapView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  tile = 48; // css px per tile
  zoomLevel = 0; // user adjustment
  camX = 0; // camera centre in tile units
  camY = 0;
  onTap?: (tx: number, ty: number) => void;
  onDraw?: (t: number) => void;
  pannable = false;
  private raf = 0;
  private ro: ResizeObserver;
  private down: { x: number; y: number; t: number; cx: number; cy: number; moved: boolean } | null = null;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "map-canvas";
    parent.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    try { this.zoomLevel = Number(localStorage.getItem("fl.zoom") ?? 0) || 0; } catch { /* ignore */ }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.resize();

    this.canvas.addEventListener("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), cx: this.camX, cy: this.camY, moved: false };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.down) return;
      const dx = e.clientX - this.down.x, dy = e.clientY - this.down.y;
      if (Math.hypot(dx, dy) > 10) this.down.moved = true;
      if (this.pannable && this.down.moved) {
        this.camX = this.down.cx - dx / this.tile;
        this.camY = this.down.cy - dy / this.tile;
      }
    });
    this.canvas.addEventListener("pointerup", (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.moved) return;
      const r = this.canvas.getBoundingClientRect();
      const t = this.screenToTile(e.clientX - r.left, e.clientY - r.top);
      this.onTap?.(t.x, t.y);
    });
    this.canvas.addEventListener("pointercancel", () => { this.down = null; });
    this.canvas.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  }

  get panning() { return !!this.down?.moved; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const base = Math.max(2, Math.min(5, Math.round(Math.min(this.w, this.h) / (16 * 13))));
    const scale = Math.max(1, Math.min(6, base + this.zoomLevel));
    this.tile = 16 * scale;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  zoom(dir: number) {
    this.zoomLevel = Math.max(-2, Math.min(3, this.zoomLevel + dir));
    try { localStorage.setItem("fl.zoom", String(this.zoomLevel)); } catch { /* ignore */ }
    this.resize();
  }

  screenToTile(x: number, y: number) {
    return { x: Math.floor((x - this.w / 2) / this.tile + this.camX + 0.5), y: Math.floor((y - this.h / 2) / this.tile + this.camY + 0.5) };
  }

  /** Top-left screen position of a tile. */
  // snapped to device pixels (not css pixels) so slow scrolling and gliding stay smooth on hi-dpi screens
  sx(tx: number) { return Math.round(((tx - this.camX - 0.5) * this.tile + this.w / 2) * this.dpr) / this.dpr; }
  sy(ty: number) { return Math.round(((ty - this.camY - 0.5) * this.tile + this.h / 2) * this.dpr) / this.dpr; }

  visible() {
    const hw = this.w / this.tile / 2 + 1, hh = this.h / this.tile / 2 + 1;
    return { x0: Math.floor(this.camX - hw), y0: Math.floor(this.camY - hh), x1: Math.ceil(this.camX + hw), y1: Math.ceil(this.camY + hh) };
  }

  img(src: CanvasImageSource, tx: number, ty: number, opts: { scale?: number; dy?: number; flip?: boolean; alpha?: number; w?: number; h?: number } = {}) {
    const s = opts.scale ?? 1;
    const tw = (opts.w ?? 1) * this.tile, th = (opts.h ?? 1) * this.tile;
    const w = tw * s, h = th * s;
    const x = this.sx(tx) + (tw - w) / 2;
    const y = this.sy(ty) + (th - h) + (opts.dy ?? 0) * this.tile;
    const c = this.ctx;
    if (opts.alpha !== undefined) c.globalAlpha = opts.alpha;
    if (opts.flip) {
      c.save();
      c.translate(x + w, y);
      c.scale(-1, 1);
      c.drawImage(src, 0, 0, w, h);
      c.restore();
    } else c.drawImage(src, x, y, w, h);
    c.globalAlpha = 1;
  }

  start() {
    let drawn = 0;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      // under a conversation or story scene: about 12 frames a second is plenty
      if (covered() && t - drawn < 80) return;
      drawn = t;
      this.ctx.imageSmoothingEnabled = false;
      this.onDraw?.(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.remove();
  }
}
