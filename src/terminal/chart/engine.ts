import type { Bar } from '../market';
import type { IndicatorConfig, IndicatorOutput } from '../indicators';
import { INDICATORS } from '../indicators';

export type ChartType = 'candles' | 'hollow' | 'bars' | 'line' | 'area' | 'heikin';
export type DrawingType = 'trend' | 'ray' | 'hline' | 'vline' | 'rect' | 'fib' | 'measure';
export type Tool = 'cursor' | DrawingType;

export interface Point {
  t: number;
  p: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  pts: Point[];
  color: string;
}

export interface PriceLine {
  price: number;
  color: string;
  label: string;
  dashed?: boolean;
}

export interface Theme {
  bg: string;
  grid: string;
  text: string;
  textStrong: string;
  border: string;
  crosshair: string;
  crosshairLabel: string;
  up: string;
  down: string;
  accent: string;
  watermark: string;
}

export interface PaneLayout {
  kind: 'main' | 'sub';
  id: string;
  top: number;
  h: number;
}

export interface ChartCallbacks {
  onCrosshair?: (index: number | null) => void;
  onDrawingsChange?: (d: Drawing[]) => void;
  onToolDone?: () => void;
  onSelect?: (id: string | null, anchor: { x: number; y: number } | null) => void;
  onLayout?: (panes: PaneLayout[], plotW: number) => void;
  onAutoScaleChange?: (auto: boolean) => void;
}

export interface ChartOptions {
  chartType: ChartType;
  decimals: number;
  logScale: boolean;
  autoScale: boolean;
  showVolume: boolean;
  theme: Theme;
  watermark: string;
  indicators: { cfg: IndicatorConfig; out: IndicatorOutput }[];
  priceLines: PriceLine[];
  drawings: Drawing[];
  tool: Tool;
  magnet: boolean;
  hideDrawings: boolean;
  lockDrawings: boolean;
}

const PRICE_AXIS_W = 72;
const TIME_AXIS_H = 28;
const HIT = 7;
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#8a93a6', '#f0506e', '#f0b44c', '#26c28b', '#3fd0c9', '#5ab0ff', '#8a93a6'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const TIME_STEPS = [MIN, 5 * MIN, 15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY];
const MONTH_STEPS = [1, 3, 6, 12, 24, 60];

type Interaction =
  | { kind: 'none' }
  | { kind: 'pan'; startX: number; startY: number; startR: number; startMin: number; startMax: number; moved: boolean }
  | { kind: 'priceScale'; startY: number; startMin: number; startMax: number }
  | { kind: 'timeScale'; startX: number; startSpacing: number }
  | { kind: 'create'; draft: Drawing; downX: number; downY: number; pointerDown: boolean }
  | { kind: 'dragHandle'; id: string; handle: number }
  | { kind: 'dragDrawing'; id: string; startIdx: number; startPrice: number; orig: Point[] }
  | { kind: 'pinch'; startDist: number; startSpacing: number };

function niceStep(range: number, count: number) {
  const raw = range / Math.max(count, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const s = n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10;
  return s * mag;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function hexA(color: string, alpha: number) {
  if (color.startsWith('#') && color.length === 7) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return color + a;
  }
  return color;
}

let drawingSeq = 1;
const newDrawingId = () => `d-${Date.now().toString(36)}-${drawingSeq++}`;

export class ChartEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private cb: ChartCallbacks;
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private bars: Bar[] = [];
  private rawBars: Bar[] = [];
  private tfMs = HOUR;
  private opts: ChartOptions;

  // view
  private spacing = 8;
  private rightIndex = 0; // fractional index at right edge
  private lastLen = 0;
  private manualMin = 0;
  private manualMax = 1;

  // computed each render
  private panes: PaneLayout[] = [];
  private plotW = 0;
  private mainMin = 0;
  private mainMax = 1;
  private subScales = new Map<string, { min: number; max: number }>();

  // interaction
  private mouse: { x: number; y: number } | null = null;
  private touchCrosshair = false;
  private crossIndex: number | null = null;
  private inter: Interaction = { kind: 'none' };
  private pointers = new Map<number, { x: number; y: number }>();
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private measure: Drawing | null = null;
  private dragged = false;

  constructor(container: HTMLElement, opts: ChartOptions, cb: ChartCallbacks) {
    this.container = container;
    this.opts = opts;
    this.cb = cb;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.onDblClick);
    window.addEventListener('keydown', this.onKey);
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.canvas.remove();
  }

  // ---------------- public API ----------------
  setData(bars: Bar[], raw: Bar[], tfMs: number, reset: boolean) {
    const wasAtEnd = this.rightIndex >= this.lastLen - 1.5;
    const grew = bars.length - this.lastLen;
    this.bars = bars;
    this.rawBars = raw;
    this.tfMs = tfMs;
    if (reset || this.lastLen === 0) {
      this.resetView();
    } else if (grew > 0 && grew < 5 && wasAtEnd) {
      this.rightIndex += grew;
    }
    this.lastLen = bars.length;
    this.requestRender();
  }

  setOptions(patch: Partial<ChartOptions>) {
    const prevLog = this.opts.logScale;
    const busy = this.inter.kind === 'dragHandle' || this.inter.kind === 'dragDrawing' || this.inter.kind === 'create';
    if (busy && patch.drawings) {
      const { drawings, ...rest } = patch;
      void drawings;
      patch = rest;
    }
    const { autoScale, ...rest } = patch;
    this.opts = { ...this.opts, ...rest };
    if (autoScale !== undefined) this.setAutoScale(autoScale);
    if (patch.logScale !== undefined && patch.logScale !== prevLog) this.setAutoScale(true);
    if (patch.tool && patch.tool !== 'cursor' && this.inter.kind === 'create') this.inter = { kind: 'none' };
    if (patch.drawings && this.selectedId && !patch.drawings.some((d) => d.id === this.selectedId)) this.select(null);
    this.requestRender();
  }

  resetView() {
    const visible = Math.max(30, Math.min(160, Math.floor((this.w - PRICE_AXIS_W) / 9)));
    this.spacing = Math.max(2, (this.w - PRICE_AXIS_W) / (visible + 6));
    this.rightIndex = this.bars.length - 1 + 6;
    this.setAutoScale(true);
    this.requestRender();
  }

  fitFrom(fromTime: number) {
    if (!this.bars.length) return;
    const t0 = this.bars[0].t;
    const startIdx = Math.max(0, Math.floor((fromTime - t0) / this.tfMs));
    const n = this.bars.length - startIdx;
    const plotW = this.w - PRICE_AXIS_W;
    this.spacing = Math.max(0.5, Math.min(60, plotW / (n + 4)));
    this.rightIndex = this.bars.length - 1 + 3;
    this.setAutoScale(true);
    this.requestRender();
  }

  scrollToLatest() {
    this.rightIndex = this.bars.length - 1 + 6;
    this.requestRender();
  }

  zoom(factor: number) {
    const anchor = this.rightIndex - (this.plotW / this.spacing) / 2;
    this.zoomAround(anchor, factor);
  }

  snapshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  updateDrawing(id: string, patch: Partial<Drawing>) {
    const next = this.opts.drawings.map((d) => (d.id === id ? { ...d, ...patch } : d));
    this.opts.drawings = next;
    this.cb.onDrawingsChange?.(next);
    this.requestRender();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    const next = this.opts.drawings.filter((d) => d.id !== this.selectedId);
    this.opts.drawings = next;
    this.select(null);
    this.cb.onDrawingsChange?.(next);
    this.requestRender();
  }

  // ---------------- coordinate mapping ----------------
  private idxToX(i: number) {
    return this.plotW - (this.rightIndex - i + 0.5) * this.spacing;
  }
  private xToIdx(x: number) {
    return this.rightIndex + 0.5 - (this.plotW - x) / this.spacing;
  }
  private timeToIdx(t: number) {
    if (!this.bars.length) return 0;
    return (t - this.bars[0].t) / this.tfMs;
  }
  private idxToTime(i: number) {
    if (!this.bars.length) return 0;
    return this.bars[0].t + i * this.tfMs;
  }
  private f(p: number) {
    return this.opts.logScale ? Math.log(Math.max(p, 1e-12)) : p;
  }
  private fInv(v: number) {
    return this.opts.logScale ? Math.exp(v) : v;
  }
  private mainMargins() {
    return { top: 0.08, bottom: this.opts.showVolume ? 0.2 : 0.08 };
  }
  private priceToY(p: number) {
    const pane = this.panes[0];
    const m = this.mainMargins();
    const inner = pane.h * (1 - m.top - m.bottom);
    const r = (this.f(p) - this.mainMin) / (this.mainMax - this.mainMin || 1);
    return pane.top + pane.h * m.top + (1 - r) * inner;
  }
  private yToPrice(y: number) {
    const pane = this.panes[0];
    const m = this.mainMargins();
    const inner = pane.h * (1 - m.top - m.bottom);
    const r = 1 - (y - pane.top - pane.h * m.top) / inner;
    return this.fInv(this.mainMin + r * (this.mainMax - this.mainMin));
  }
  private subY(id: string, v: number) {
    const pane = this.panes.find((p) => p.id === id)!;
    const s = this.subScales.get(id)!;
    const inner = pane.h * 0.8;
    const r = (v - s.min) / (s.max - s.min || 1);
    return pane.top + pane.h * 0.1 + (1 - r) * inner;
  }
  private subYToValue(id: string, y: number) {
    const pane = this.panes.find((p) => p.id === id)!;
    const s = this.subScales.get(id)!;
    const r = 1 - (y - pane.top - pane.h * 0.1) / (pane.h * 0.8);
    return s.min + r * (s.max - s.min);
  }

  // ---------------- layout ----------------
  private resize() {
    const rect = this.container.getBoundingClientRect();
    this.w = Math.max(100, Math.floor(rect.width));
    this.h = Math.max(100, Math.floor(rect.height));
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    if (this.lastLen && this.rightIndex === 0) this.resetView();
    this.renderNow();
  }

  private computeLayout() {
    this.plotW = this.w - PRICE_AXIS_W;
    const subs = this.opts.indicators.filter((i) => INDICATORS[i.cfg.type].pane === 'sub' && !i.cfg.hidden);
    const avail = this.h - TIME_AXIS_H;
    const subH = subs.length ? Math.max(70, Math.min(140, avail * (subs.length > 2 ? 0.16 : 0.2))) : 0;
    const mainH = Math.max(120, avail - subH * subs.length);
    const panes: PaneLayout[] = [{ kind: 'main', id: 'main', top: 0, h: mainH }];
    let top = mainH;
    for (const s of subs) {
      panes.push({ kind: 'sub', id: s.cfg.id, top, h: subH });
      top += subH;
    }
    const changed =
      panes.length !== this.panes.length ||
      panes.some((p, i) => p.id !== this.panes[i]?.id || Math.abs(p.h - this.panes[i].h) > 0.5) ||
      this.plotW !== this.lastPlotW;
    this.panes = panes;
    if (changed) {
      this.lastPlotW = this.plotW;
      this.cb.onLayout?.(panes, this.plotW);
    }
  }
  private lastPlotW = 0;

  private visibleRange(): [number, number] {
    const a = Math.max(0, Math.floor(this.xToIdx(0)));
    const b = Math.min(this.bars.length - 1, Math.ceil(this.xToIdx(this.plotW)));
    return [a, b];
  }

  private computeScales() {
    const [a, b] = this.visibleRange();
    if (this.opts.autoScale) {
      let lo = Infinity;
      let hi = -Infinity;
      const lineOnly = this.opts.chartType === 'line' || this.opts.chartType === 'area';
      for (let i = a; i <= b; i++) {
        const bar = this.bars[i];
        if (lineOnly) {
          lo = Math.min(lo, bar.c);
          hi = Math.max(hi, bar.c);
        } else {
          lo = Math.min(lo, bar.l);
          hi = Math.max(hi, bar.h);
        }
      }
      for (const ind of this.opts.indicators) {
        if (ind.cfg.hidden || INDICATORS[ind.cfg.type].pane !== 'overlay') continue;
        for (const s of ind.out.series) {
          for (let i = a; i <= b; i++) {
            const v = s.values[i];
            if (!isNaN(v)) {
              lo = Math.min(lo, v);
              hi = Math.max(hi, v);
            }
          }
        }
      }
      if (!isFinite(lo)) {
        lo = 0;
        hi = 1;
      }
      let fl = this.f(lo);
      let fh = this.f(hi);
      if (fh - fl < 1e-9) {
        const d = Math.abs(fh) * 0.01 || 1;
        fl -= d;
        fh += d;
      }
      this.mainMin = fl;
      this.mainMax = fh;
    } else {
      this.mainMin = this.manualMin;
      this.mainMax = this.manualMax;
    }

    this.subScales.clear();
    for (const ind of this.opts.indicators) {
      if (ind.cfg.hidden || INDICATORS[ind.cfg.type].pane !== 'sub') continue;
      if (ind.out.range) {
        this.subScales.set(ind.cfg.id, { min: ind.out.range[0], max: ind.out.range[1] });
        continue;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (const s of ind.out.series) {
        for (let i = a; i <= b; i++) {
          const v = s.values[i];
          if (!isNaN(v)) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
        }
        if (s.style === 'histogram') {
          lo = Math.min(lo, 0);
          hi = Math.max(hi, 0);
        }
      }
      if (!isFinite(lo)) {
        lo = 0;
        hi = 1;
      }
      if (hi - lo < 1e-12) {
        hi += 1;
        lo -= 1;
      }
      this.subScales.set(ind.cfg.id, { min: lo, max: hi });
    }
  }

  private setAutoScale(v: boolean) {
    if (this.opts.autoScale === v) return;
    if (!v) {
      this.manualMin = this.mainMin;
      this.manualMax = this.mainMax;
    }
    this.opts.autoScale = v;
    this.cb.onAutoScaleChange?.(v);
  }

  // ---------------- rendering ----------------
  requestRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderNow();
    });
  }

  private renderNow() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const th = this.opts.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!this.bars.length) return;

    this.computeLayout();
    this.computeScales();
    const font = (size: number, weight = 400) => `${weight} ${size}px Inter, system-ui, sans-serif`;

    // watermark
    const main = this.panes[0];
    ctx.save();
    ctx.fillStyle = th.watermark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(Math.min(72, this.plotW / 8), 700);
    ctx.fillText(this.opts.watermark, this.plotW / 2, main.top + main.h * 0.45);
    ctx.restore();

    this.drawTimeGrid();
    for (const pane of this.panes) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, pane.top, this.plotW, pane.h);
      ctx.clip();
      if (pane.kind === 'main') this.drawMainPane();
      else this.drawSubPane(pane);
      ctx.restore();
      if (pane.kind === 'sub') {
        ctx.strokeStyle = th.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(pane.top) + 0.5);
        ctx.lineTo(this.w, Math.round(pane.top) + 0.5);
        ctx.stroke();
      }
    }

    this.drawCrosshair();
    this.drawPriceAxis();
    this.drawTimeAxis();
  }

  private timeTicks(): { x: number; label: string; major: boolean }[] {
    const [a, b] = this.visibleRange();
    if (b < a) return [];
    const minPx = 88;
    const tz = new Date().getTimezoneOffset() * MIN;
    const pxPerMs = this.spacing / this.tfMs;
    const step = TIME_STEPS.find((s) => s >= this.tfMs && s * pxPerMs >= minPx);
    let monthStep = 0;
    if (!step) {
      monthStep = MONTH_STEPS.find((m) => m * 30 * DAY * pxPerMs >= minPx) ?? 120;
    }
    const ticks: { x: number; label: string; major: boolean }[] = [];
    let prevKey = NaN;
    let lastX = -Infinity;
    const start = Math.max(0, a - 1);
    for (let i = start; i <= b; i++) {
      const t = this.bars[i].t;
      const d = new Date(t);
      let key: number;
      if (step) key = Math.floor((t - tz) / step);
      else key = Math.floor((d.getFullYear() * 12 + d.getMonth()) / monthStep);
      if (i > start && key !== prevKey) {
        const x = this.idxToX(i);
        if (x - lastX >= minPx * 0.7 && x > 0) {
          const prev = new Date(this.bars[i - 1].t);
          let label: string;
          let major = false;
          if (d.getFullYear() !== prev.getFullYear()) {
            label = String(d.getFullYear());
            major = true;
          } else if (d.getMonth() !== prev.getMonth()) {
            label = MONTHS[d.getMonth()];
            major = true;
          } else if (d.getDate() !== prev.getDate()) {
            label = step && step < DAY ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : String(d.getDate());
            major = !!step && step < DAY;
          } else {
            label = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          }
          ticks.push({ x, label, major });
          lastX = x;
        }
      }
      prevKey = key;
    }
    return ticks;
  }

  private drawTimeGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = this.opts.theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of this.timeTicks()) {
      const x = Math.round(t.x) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h - TIME_AXIS_H);
    }
    ctx.stroke();
  }

  private priceTicks(): number[] {
    const pane = this.panes[0];
    const lo = this.yToPrice(pane.top + pane.h);
    const hi = this.yToPrice(pane.top);
    const step = niceStep(hi - lo, pane.h / 52);
    const out: number[] = [];
    if (!isFinite(step) || step <= 0) return out;
    let lastY = Infinity;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const y = this.priceToY(v);
      if (Math.abs(lastY - y) < 22) continue;
      out.push(v);
      lastY = y;
    }
    return out;
  }

  private drawMainPane() {
    const ctx = this.ctx;
    const th = this.opts.theme;
    const pane = this.panes[0];
    const [a, b] = this.visibleRange();

    // grid
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const v of this.priceTicks()) {
      const y = Math.round(this.priceToY(v)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(this.plotW, y);
    }
    ctx.stroke();

    // volume
    if (this.opts.showVolume) {
      let maxV = 0;
      for (let i = a; i <= b; i++) maxV = Math.max(maxV, this.rawBars[i]?.v ?? 0);
      const volH = pane.h * 0.16;
      const bw = Math.max(1, this.spacing * 0.7);
      for (let i = a; i <= b; i++) {
        const raw = this.rawBars[i];
        if (!raw) continue;
        const vh = (raw.v / (maxV || 1)) * volH;
        const x = this.idxToX(i);
        ctx.fillStyle = hexA(raw.c >= raw.o ? th.up : th.down, 0.28);
        ctx.fillRect(x - bw / 2, pane.top + pane.h - vh, bw, vh);
      }
    }

    // overlay indicators
    for (const ind of this.opts.indicators) {
      if (ind.cfg.hidden || INDICATORS[ind.cfg.type].pane !== 'overlay') continue;
      const out = ind.out;
      if (out.fill) {
        const s1 = out.series[out.fill.from].values;
        const s2 = out.series[out.fill.to].values;
        ctx.fillStyle = hexA(out.fill.color, 0.07);
        ctx.beginPath();
        let started = false;
        const back: [number, number][] = [];
        for (let i = Math.max(0, a - 1); i <= Math.min(this.bars.length - 1, b + 1); i++) {
          if (isNaN(s1[i]) || isNaN(s2[i])) continue;
          const x = this.idxToX(i);
          const y = this.priceToY(s1[i]);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
          back.push([x, this.priceToY(s2[i])]);
        }
        for (let k = back.length - 1; k >= 0; k--) ctx.lineTo(back[k][0], back[k][1]);
        ctx.closePath();
        if (started) ctx.fill();
      }
      for (const s of out.series) this.drawLineSeries(s.values, s.color, s.width ?? 1.5, a, b, (v) => this.priceToY(v));
    }

    this.drawPriceSeries(a, b);

    // price lines (positions, alerts)
    for (const pl of this.opts.priceLines) {
      const y = Math.round(this.priceToY(pl.price)) + 0.5;
      ctx.strokeStyle = pl.color;
      ctx.lineWidth = 1;
      ctx.setLineDash(pl.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(pl.label).width + 12;
      const lx = this.plotW - tw - 70;
      ctx.fillStyle = pl.color;
      this.roundRect(lx, y - 10, tw, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pl.label, lx + 6, y + 0.5);
    }

    // last price line
    const last = this.bars[this.bars.length - 1];
    const lastRaw = this.rawBars[this.rawBars.length - 1];
    const lastColor = lastRaw.c >= lastRaw.o ? th.up : th.down;
    const ly = Math.round(this.priceToY(lastRaw.c)) + 0.5;
    ctx.strokeStyle = lastColor;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.max(0, this.idxToX(this.bars.length - 1)), ly);
    ctx.lineTo(this.plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    void last;

    if (!this.opts.hideDrawings) {
      for (const d of this.opts.drawings) this.drawDrawing(d);
      if (this.inter.kind === 'create') this.drawDrawing(this.inter.draft);
      if (this.measure) this.drawDrawing(this.measure);
    }
  }

  private drawLineSeries(values: number[], color: string, width: number, a: number, b: number, toY: (v: number) => number) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (let i = Math.max(0, a - 1); i <= Math.min(values.length - 1, b + 1); i++) {
      const v = values[i];
      if (isNaN(v)) {
        pen = false;
        continue;
      }
      const x = this.idxToX(i);
      const y = toY(v);
      if (!pen) {
        ctx.moveTo(x, y);
        pen = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawPriceSeries(a: number, b: number) {
    const ctx = this.ctx;
    const th = this.opts.theme;
    const type = this.opts.chartType;
    if (type === 'line' || type === 'area') {
      const closes = this.bars.map((x) => x.c);
      if (type === 'area') {
        const pane = this.panes[0];
        const grad = ctx.createLinearGradient(0, pane.top, 0, pane.top + pane.h);
        grad.addColorStop(0, hexA(th.accent, 0.32));
        grad.addColorStop(1, hexA(th.accent, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        const s = Math.max(0, a - 1);
        const e = Math.min(this.bars.length - 1, b + 1);
        ctx.moveTo(this.idxToX(s), pane.top + pane.h);
        for (let i = s; i <= e; i++) ctx.lineTo(this.idxToX(i), this.priceToY(closes[i]));
        ctx.lineTo(this.idxToX(e), pane.top + pane.h);
        ctx.closePath();
        ctx.fill();
      }
      this.drawLineSeries(closes, th.accent, 2, a, b, (v) => this.priceToY(v));
      return;
    }

    let bw = Math.max(1, Math.floor(this.spacing * 0.72));
    if (bw > 2 && bw % 2 === 0) bw -= 1;
    for (let i = a; i <= b; i++) {
      const bar = this.bars[i];
      const up = bar.c >= bar.o;
      const color = up ? th.up : th.down;
      const x = Math.round(this.idxToX(i));
      const yo = this.priceToY(bar.o);
      const yc = this.priceToY(bar.c);
      const yh = this.priceToY(bar.h);
      const yl = this.priceToY(bar.l);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      if (type === 'bars') {
        const tick = Math.max(1, Math.floor(bw / 2));
        ctx.lineWidth = this.spacing > 6 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yh);
        ctx.lineTo(x + 0.5, yl);
        ctx.moveTo(x - tick, Math.round(yo) + 0.5);
        ctx.lineTo(x + 0.5, Math.round(yo) + 0.5);
        ctx.moveTo(x + 0.5, Math.round(yc) + 0.5);
        ctx.lineTo(x + tick + 1, Math.round(yc) + 0.5);
        ctx.stroke();
        continue;
      }
      // wick
      ctx.beginPath();
      ctx.moveTo(x + 0.5, Math.round(yh));
      ctx.lineTo(x + 0.5, Math.round(yl));
      ctx.stroke();
      const top = Math.round(Math.min(yo, yc));
      const hgt = Math.max(1, Math.round(Math.abs(yc - yo)));
      const left = x - Math.floor(bw / 2);
      if (type === 'hollow' && up && bw > 2) {
        ctx.fillStyle = th.bg;
        ctx.fillRect(left, top, bw, hgt);
        ctx.strokeRect(left + 0.5, top + 0.5, bw - 1, Math.max(0, hgt - 1));
      } else {
        ctx.fillRect(left, top, bw, hgt);
      }
    }
  }

  private drawSubPane(pane: PaneLayout) {
    const ctx = this.ctx;
    const th = this.opts.theme;
    const ind = this.opts.indicators.find((i) => i.cfg.id === pane.id);
    if (!ind) return;
    const [a, b] = this.visibleRange();
    const toY = (v: number) => this.subY(pane.id, v);
    if (ind.out.levels) {
      ctx.strokeStyle = hexA(th.text, 0.35);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const l of ind.out.levels) {
        const y = Math.round(toY(l)) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(this.plotW, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (ind.out.range && ind.out.levels.length >= 2) {
        const lv = ind.out.levels;
        const y1 = toY(lv[lv.length - 1]);
        const y2 = toY(lv[0]);
        ctx.fillStyle = hexA(ind.cfg.colors[0], 0.06);
        ctx.fillRect(0, y1, this.plotW, y2 - y1);
      }
    }
    for (const s of ind.out.series) {
      if (s.style === 'histogram') {
        const [cu, cd] = s.color.split('|');
        const bw = Math.max(1, this.spacing * 0.6);
        const y0 = toY(0);
        for (let i = a; i <= b; i++) {
          const v = s.values[i];
          if (isNaN(v)) continue;
          const prev = s.values[i - 1];
          const rising = isNaN(prev) || v >= prev;
          const base = v >= 0 ? cu : cd;
          ctx.fillStyle = hexA(base, rising === v >= 0 ? 0.85 : 0.4);
          const y = toY(v);
          ctx.fillRect(this.idxToX(i) - bw / 2, Math.min(y, y0), bw, Math.abs(y - y0) || 1);
        }
      } else {
        this.drawLineSeries(s.values, s.color, s.width ?? 1.5, a, b, toY);
      }
    }
  }

  private drawDrawing(d: Drawing) {
    const ctx = this.ctx;
    const th = this.opts.theme;
    const selected = d.id === this.selectedId;
    const hovered = d.id === this.hoverId;
    const pts = d.pts.map((p) => ({ x: this.idxToX(this.timeToIdx(p.t)), y: this.priceToY(p.p) }));
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = selected || hovered ? 2 : 1.5;
    ctx.lineCap = 'round';
    const [p1, p2] = pts;
    switch (d.type) {
      case 'trend':
      case 'ray': {
        let end = p2;
        if (d.type === 'ray' && (p2.x !== p1.x || p2.y !== p1.y)) {
          const k = (this.plotW * 4) / Math.max(1e-6, Math.hypot(p2.x - p1.x, p2.y - p1.y));
          end = { x: p1.x + (p2.x - p1.x) * k, y: p1.y + (p2.y - p1.y) * k };
        }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'hline': {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(p1.y) + 0.5);
        ctx.lineTo(this.plotW, Math.round(p1.y) + 0.5);
        ctx.stroke();
        break;
      }
      case 'vline': {
        ctx.beginPath();
        ctx.moveTo(Math.round(p1.x) + 0.5, 0);
        ctx.lineTo(Math.round(p1.x) + 0.5, this.panes[0].h);
        ctx.stroke();
        break;
      }
      case 'rect': {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.fillStyle = hexA(d.color, 0.14);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'fib': {
        const x1 = Math.min(p1.x, p2.x);
        const x2 = Math.max(p1.x, p2.x);
        const dp = d.pts[1].p - d.pts[0].p;
        let prevY: number | null = null;
        FIB_LEVELS.forEach((lv, k) => {
          const price = d.pts[1].p - dp * lv;
          const y = this.priceToY(price);
          if (prevY !== null) {
            ctx.fillStyle = hexA(FIB_COLORS[k], 0.08);
            ctx.fillRect(x1, Math.min(prevY, y), x2 - x1, Math.abs(y - prevY));
          }
          prevY = y;
          ctx.strokeStyle = FIB_COLORS[k];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, Math.round(y) + 0.5);
          ctx.lineTo(x2, Math.round(y) + 0.5);
          ctx.stroke();
          ctx.fillStyle = FIB_COLORS[k];
          ctx.font = '500 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${lv} (${this.fmt(price)})`, x1 - 4, y + 5);
        });
        ctx.strokeStyle = hexA(d.color, 0.6);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'measure': {
        const up = d.pts[1].p >= d.pts[0].p;
        const col = up ? th.accent : th.down;
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.fillStyle = hexA(col, 0.16);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const mx = (p1.x + p2.x) / 2;
        ctx.moveTo(mx, p1.y);
        ctx.lineTo(mx, p2.y);
        ctx.moveTo(p1.x, (p1.y + p2.y) / 2);
        ctx.lineTo(p2.x, (p1.y + p2.y) / 2);
        ctx.stroke();
        const dp = d.pts[1].p - d.pts[0].p;
        const pct = (dp / d.pts[0].p) * 100;
        const nBars = Math.round(this.timeToIdx(d.pts[1].t) - this.timeToIdx(d.pts[0].t));
        const dur = this.formatDuration(Math.abs(d.pts[1].t - d.pts[0].t));
        const l1 = `${dp >= 0 ? '+' : ''}${this.fmt(dp)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        const l2 = `${nBars} bars, ${dur}`;
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const tw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 16;
        const bx = mx - tw / 2;
        const by = up ? y - 44 : y + h + 6;
        ctx.fillStyle = col;
        this.roundRect(bx, by, tw, 38, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(l1, mx, by + 12);
        ctx.font = '500 11px Inter, system-ui, sans-serif';
        ctx.fillText(l2, mx, by + 27);
        break;
      }
    }
    if (selected || (hovered && !this.opts.lockDrawings)) {
      for (const p of this.handles(d)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = th.bg;
        ctx.fill();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private handles(d: Drawing) {
    const pts = d.pts.map((p) => ({ x: this.idxToX(this.timeToIdx(p.t)), y: this.priceToY(p.p) }));
    if (d.type === 'hline') return [{ x: Math.min(this.plotW - 40, Math.max(20, pts[0].x)), y: pts[0].y }];
    if (d.type === 'vline') return [{ x: pts[0].x, y: Math.max(20, Math.min(this.panes[0].h - 20, pts[0].y)) }];
    return pts;
  }

  private drawCrosshair() {
    if (!this.mouse || this.crossIndex === null) return;
    if (this.inter.kind === 'pan' && !this.touchCrosshair && this.inter.moved) return;
    const ctx = this.ctx;
    const th = this.opts.theme;
    const x = Math.round(this.idxToX(this.crossIndex)) + 0.5;
    const y = Math.round(this.mouse.y) + 0.5;
    ctx.strokeStyle = th.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.h - TIME_AXIS_H);
    if (this.mouse.x < this.plotW && y < this.h - TIME_AXIS_H) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.plotW, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPriceAxis() {
    const ctx = this.ctx;
    const th = this.opts.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(this.plotW, 0, PRICE_AXIS_W, this.h);
    ctx.strokeStyle = th.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.plotW + 0.5, 0);
    ctx.lineTo(this.plotW + 0.5, this.h);
    ctx.stroke();

    ctx.font = '400 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = th.text;
    const main = this.panes[0];
    for (const v of this.priceTicks()) {
      const y = this.priceToY(v);
      if (y < main.top + 8 || y > main.top + main.h - 8) continue;
      ctx.fillText(this.fmt(v), this.plotW + 8, y);
    }
    for (const pane of this.panes.slice(1)) {
      const s = this.subScales.get(pane.id);
      const ind = this.opts.indicators.find((i) => i.cfg.id === pane.id);
      if (!s || !ind) continue;
      const vals = ind.out.levels && ind.out.range ? ind.out.levels : (() => {
        const step = niceStep(s.max - s.min, 3);
        const arr: number[] = [];
        for (let v = Math.ceil(s.min / step) * step; v <= s.max; v += step) arr.push(v);
        return arr;
      })();
      ctx.fillStyle = th.text;
      for (const v of vals) {
        const y = this.subY(pane.id, v);
        if (y < pane.top + 8 || y > pane.top + pane.h - 6) continue;
        ctx.fillText(this.fmtCompact(v), this.plotW + 8, y);
      }
      // last value tags
      for (const ser of ind.out.series) {
        if (ser.style === 'histogram') continue;
        const lastV = ser.values[ser.values.length - 1];
        if (isNaN(lastV)) continue;
        this.axisTag(this.subY(pane.id, lastV), this.fmtCompact(lastV), ser.color, pane.top, pane.top + pane.h);
      }
    }

    // price lines
    for (const pl of this.opts.priceLines) this.axisTag(this.priceToY(pl.price), this.fmt(pl.price), pl.color, main.top, main.top + main.h);

    // overlay indicator last values
    for (const ind of this.opts.indicators) {
      if (ind.cfg.hidden || INDICATORS[ind.cfg.type].pane !== 'overlay') continue;
      const s = ind.out.series[0];
      const v = s.values[s.values.length - 1];
      if (!isNaN(v)) this.axisTag(this.priceToY(v), this.fmt(v), s.color, main.top, main.top + main.h, true);
    }

    // last price tag + countdown
    const lastRaw = this.rawBars[this.rawBars.length - 1];
    const color = lastRaw.c >= lastRaw.o ? th.up : th.down;
    const ly = this.priceToY(lastRaw.c);
    if (ly > main.top && ly < main.top + main.h) {
      const remaining = Math.max(0, lastRaw.t + this.tfMs - Date.now());
      const cd = this.formatCountdown(remaining);
      ctx.fillStyle = color;
      ctx.fillRect(this.plotW + 1, ly - 10, PRICE_AXIS_W - 1, 34);
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.fillText(this.fmt(lastRaw.c), this.plotW + 8, ly + 1);
      ctx.font = '400 10px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText(cd, this.plotW + 8, ly + 15);
    }

    // crosshair tag
    if (this.mouse && this.mouse.y < this.h - TIME_AXIS_H) {
      const pane = this.panes.find((p) => this.mouse!.y >= p.top && this.mouse!.y < p.top + p.h);
      if (pane) {
        const label = pane.kind === 'main' ? this.fmt(this.yToPrice(this.mouse.y)) : this.fmtCompact(this.subYToValue(pane.id, this.mouse.y));
        this.axisTag(this.mouse.y, label, th.crosshairLabel, 0, this.h);
      }
    }
  }

  private axisTag(y: number, label: string, color: string, minY: number, maxY: number, subtle = false) {
    if (y < minY || y > maxY) return;
    const ctx = this.ctx;
    ctx.fillStyle = subtle ? hexA(color, 0.9) : color;
    ctx.fillRect(this.plotW + 1, y - 10, PRICE_AXIS_W - 1, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.plotW + 8, y + 0.5);
  }

  private drawTimeAxis() {
    const ctx = this.ctx;
    const th = this.opts.theme;
    const y0 = this.h - TIME_AXIS_H;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, y0, this.w, TIME_AXIS_H);
    ctx.strokeStyle = th.border;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 0.5);
    ctx.lineTo(this.w, y0 + 0.5);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.timeTicks()) {
      ctx.font = t.major ? '600 11px Inter, system-ui, sans-serif' : '400 11px Inter, system-ui, sans-serif';
      ctx.fillStyle = t.major ? th.textStrong : th.text;
      ctx.fillText(t.label, t.x, y0 + TIME_AXIS_H / 2);
    }
    if (this.mouse && this.crossIndex !== null) {
      const x = this.idxToX(this.crossIndex);
      const label = this.formatCrossTime(this.idxToTime(this.crossIndex));
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 16;
      const lx = Math.max(0, Math.min(this.plotW - tw, x - tw / 2));
      ctx.fillStyle = th.crosshairLabel;
      ctx.fillRect(lx, y0 + 1, tw, TIME_AXIS_H - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + tw / 2, y0 + TIME_AXIS_H / 2);
    }
    // corner
    ctx.fillStyle = th.bg;
    ctx.fillRect(this.plotW + 1, y0 + 1, PRICE_AXIS_W, TIME_AXIS_H);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------- formatting ----------------
  private fmt(v: number) {
    return v.toLocaleString('en-US', { minimumFractionDigits: this.opts.decimals, maximumFractionDigits: this.opts.decimals });
  }
  private fmtCompact(v: number) {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    return v.toFixed(4);
  }
  private formatCrossTime(t: number) {
    const d = new Date(t);
    const date = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    return this.tfMs < DAY ? `${date}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : date;
  }
  private formatCountdown(ms: number) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${pad2(h)}h`;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
    return `${pad2(m)}:${pad2(sec)}`;
  }
  private formatDuration(ms: number) {
    const m = Math.round(ms / MIN);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim();
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24 ? (h % 24) + 'h' : ''}`.trim();
  }

  // ---------------- interaction ----------------
  private local(e: PointerEvent | WheelEvent | MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private region(x: number, y: number): 'price' | 'time' | 'main' | 'sub' {
    if (y >= this.h - TIME_AXIS_H) return 'time';
    if (x >= this.plotW) return 'price';
    return y < this.panes[0].h ? 'main' : 'sub';
  }

  private pointAt(x: number, y: number): Point {
    let idx = Math.round(this.xToIdx(x));
    let price = this.yToPrice(y);
    if (this.opts.magnet && idx >= 0 && idx < this.bars.length) {
      const b = this.bars[idx];
      const cands = [b.o, b.h, b.l, b.c];
      let best = cands[0];
      for (const c of cands) if (Math.abs(this.priceToY(c) - y) < Math.abs(this.priceToY(best) - y)) best = c;
      if (Math.abs(this.priceToY(best) - y) < 40) price = best;
    }
    idx = Math.max(-5000, idx);
    return { t: this.idxToTime(idx), p: price };
  }

  private hitDrawing(x: number, y: number): { id: string; handle: number } | null {
    if (this.opts.hideDrawings) return null;
    const list = this.opts.drawings;
    // selected drawing handles first
    for (let k = list.length - 1; k >= 0; k--) {
      const d = list[k];
      const hs = this.handles(d);
      for (let i = 0; i < hs.length; i++) if (Math.hypot(hs[i].x - x, hs[i].y - y) <= HIT + 1) return { id: d.id, handle: i };
    }
    for (let k = list.length - 1; k >= 0; k--) {
      const d = list[k];
      const pts = d.pts.map((p) => ({ x: this.idxToX(this.timeToIdx(p.t)), y: this.priceToY(p.p) }));
      const [p1, p2] = pts;
      let hit = false;
      switch (d.type) {
        case 'trend':
          hit = distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < HIT;
          break;
        case 'ray': {
          const k2 = (this.plotW * 4) / Math.max(1e-6, Math.hypot(p2.x - p1.x, p2.y - p1.y));
          hit = distToSegment(x, y, p1.x, p1.y, p1.x + (p2.x - p1.x) * k2, p1.y + (p2.y - p1.y) * k2) < HIT;
          break;
        }
        case 'hline':
          hit = Math.abs(y - p1.y) < HIT;
          break;
        case 'vline':
          hit = Math.abs(x - p1.x) < HIT && y < this.panes[0].h;
          break;
        case 'rect': {
          const x1 = Math.min(p1.x, p2.x);
          const x2 = Math.max(p1.x, p2.x);
          const y1 = Math.min(p1.y, p2.y);
          const y2 = Math.max(p1.y, p2.y);
          hit = x >= x1 - HIT && x <= x2 + HIT && y >= y1 - HIT && y <= y2 + HIT;
          break;
        }
        case 'fib': {
          const x1 = Math.min(p1.x, p2.x);
          const x2 = Math.max(p1.x, p2.x);
          if (x >= x1 - HIT && x <= x2 + HIT) {
            const dp = d.pts[1].p - d.pts[0].p;
            hit = FIB_LEVELS.some((lv) => Math.abs(this.priceToY(d.pts[1].p - dp * lv) - y) < HIT);
          }
          break;
        }
        default:
          break;
      }
      if (hit) return { id: d.id, handle: -1 };
    }
    return null;
  }

  private select(id: string | null) {
    this.selectedId = id;
    if (!id) {
      this.cb.onSelect?.(null, null);
      return;
    }
    const d = this.opts.drawings.find((x) => x.id === id);
    if (!d) return;
    const hs = this.handles(d);
    const ax = Math.max(...hs.map((h) => h.x));
    const ay = Math.min(...hs.map((h) => h.y));
    this.cb.onSelect?.(id, { x: Math.min(this.plotW - 160, Math.max(8, ax - 80)), y: Math.max(8, ay - 52) });
  }

  private updateCrosshair(x: number, y: number) {
    this.mouse = { x, y };
    const idx = Math.round(this.xToIdx(Math.min(x, this.plotW - 1)));
    if (idx !== this.crossIndex) {
      this.crossIndex = idx;
      this.cb.onCrosshair?.(idx >= 0 && idx < this.bars.length ? idx : null);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.bars.length) return;
    const { x, y } = this.local(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x, y });
    this.dragged = false;
    if (e.pointerType !== 'mouse') this.touchCrosshair = false;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.inter = { kind: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y), startSpacing: this.spacing };
      return;
    }

    const region = this.region(x, y);
    if (this.measure && this.opts.tool !== 'measure') {
      this.measure = null;
      this.requestRender();
    }
    if (region === 'price') {
      this.inter = { kind: 'priceScale', startY: y, startMin: this.mainMin, startMax: this.mainMax };
      return;
    }
    if (region === 'time') {
      this.inter = { kind: 'timeScale', startX: x, startSpacing: this.spacing };
      return;
    }

    const tool = this.opts.tool;
    if (tool !== 'cursor' && region === 'main') {
      const pt = this.pointAt(x, y);
      if (this.inter.kind === 'create') {
        this.inter.draft.pts[this.inter.draft.pts.length - 1] = pt;
        this.finishDraft(this.inter.draft);
        return;
      }
      if (tool === 'measure') this.measure = null;
      const color = tool === 'fib' ? '#8a93a6' : tool === 'measure' ? this.opts.theme.accent : '#5ab0ff';
      const draft: Drawing = { id: newDrawingId(), type: tool, pts: tool === 'hline' || tool === 'vline' ? [pt] : [pt, { ...pt }], color };
      if (draft.pts.length === 1) {
        this.finishDraft(draft);
        return;
      }
      this.inter = { kind: 'create', draft, downX: x, downY: y, pointerDown: true };
      this.requestRender();
      return;
    }

    if (region === 'main' && !this.opts.lockDrawings) {
      const hit = this.hitDrawing(x, y);
      if (hit) {
        this.select(hit.id);
        if (hit.handle >= 0) this.inter = { kind: 'dragHandle', id: hit.id, handle: hit.handle };
        else {
          const d = this.opts.drawings.find((dd) => dd.id === hit.id)!;
          this.inter = { kind: 'dragDrawing', id: hit.id, startIdx: this.xToIdx(x), startPrice: this.yToPrice(y), orig: d.pts.map((p) => ({ ...p })) };
        }
        this.requestRender();
        return;
      }
    }
    if (this.selectedId) this.select(null);
    this.inter = { kind: 'pan', startX: x, startY: y, startR: this.rightIndex, startMin: this.mainMin, startMax: this.mainMax, moved: false };
    this.canvas.style.cursor = 'grabbing';
    this.requestRender();
  };

  private finishDraft(d: Drawing) {
    this.inter = { kind: 'none' };
    if (d.type === 'measure') {
      this.measure = d;
      this.cb.onToolDone?.();
      this.requestRender();
      return;
    }
    const next = [...this.opts.drawings, d];
    this.opts.drawings = next;
    this.cb.onDrawingsChange?.(next);
    this.cb.onToolDone?.();
    this.select(d.id);
    this.requestRender();
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.bars.length) return;
    const { x, y } = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
    const inter = this.inter;

    if (inter.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.max(0.5, Math.min(60, inter.startSpacing * (dist / inter.startDist)));
      const anchor = this.xToIdx((a.x + b.x) / 2);
      this.zoomAround(anchor, target / this.spacing);
      return;
    }

    if (e.pointerType === 'mouse' || this.pointers.size === 0 || inter.kind === 'create') this.updateCrosshair(x, y);

    switch (inter.kind) {
      case 'pan': {
        const dx = x - inter.startX;
        const dy = y - inter.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) inter.moved = true;
        this.rightIndex = this.clampRight(inter.startR - dx / this.spacing);
        if (!this.opts.autoScale && y < this.panes[0].h) {
          const pane = this.panes[0];
          const m = this.mainMargins();
          const per = (inter.startMax - inter.startMin) / (pane.h * (1 - m.top - m.bottom));
          this.manualMin = inter.startMin + dy * per;
          this.manualMax = inter.startMax + dy * per;
        }
        if (e.pointerType !== 'mouse' && inter.moved) {
          this.mouse = null;
          this.crossIndex = null;
          this.cb.onCrosshair?.(null);
        }
        this.requestRender();
        return;
      }
      case 'priceScale': {
        this.setAutoScale(false);
        const factor = Math.exp((y - inter.startY) * 0.006);
        const mid = (inter.startMin + inter.startMax) / 2;
        const half = ((inter.startMax - inter.startMin) / 2) * factor;
        this.manualMin = mid - half;
        this.manualMax = mid + half;
        this.requestRender();
        return;
      }
      case 'timeScale': {
        const factor = Math.exp((x - inter.startX) * 0.008);
        const target = Math.max(0.5, Math.min(60, inter.startSpacing * factor));
        this.zoomAround(this.rightIndex, target / this.spacing);
        return;
      }
      case 'create': {
        inter.draft.pts[inter.draft.pts.length - 1] = this.pointAt(x, y);
        this.requestRender();
        return;
      }
      case 'dragHandle': {
        this.dragged = true;
        const pt = this.pointAt(x, y);
        this.opts.drawings = this.opts.drawings.map((d) => {
          if (d.id !== inter.id) return d;
          const pts = d.pts.map((p) => ({ ...p }));
          if (d.type === 'hline') pts[0].p = pt.p;
          else if (d.type === 'vline') pts[0].t = pt.t;
          else pts[inter.handle] = pt;
          return { ...d, pts };
        });
        this.select(inter.id);
        this.requestRender();
        return;
      }
      case 'dragDrawing': {
        this.dragged = true;
        const dIdx = Math.round(this.xToIdx(x) - inter.startIdx);
        const dP = this.yToPrice(y) - inter.startPrice;
        this.opts.drawings = this.opts.drawings.map((d) =>
          d.id !== inter.id ? d : { ...d, pts: inter.orig.map((p) => ({ t: p.t + dIdx * this.tfMs, p: p.p + dP })) },
        );
        this.select(inter.id);
        this.requestRender();
        return;
      }
      default:
        break;
    }

    // hover
    const region = this.region(x, y);
    let cursor = 'crosshair';
    if (region === 'price') cursor = 'ns-resize';
    else if (region === 'time') cursor = 'ew-resize';
    else if (region === 'main' && this.opts.tool === 'cursor' && !this.opts.lockDrawings) {
      const hit = this.hitDrawing(x, y);
      const id = hit?.id ?? null;
      if (id !== this.hoverId) this.hoverId = id;
      if (hit) cursor = hit.handle >= 0 ? 'pointer' : 'move';
    }
    this.canvas.style.cursor = cursor;
    this.requestRender();
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const inter = this.inter;
    const { x, y } = this.local(e);
    if (inter.kind === 'create') {
      const moved = Math.hypot(x - inter.downX, y - inter.downY) > 6;
      if (moved && inter.pointerDown) {
        inter.draft.pts[inter.draft.pts.length - 1] = this.pointAt(x, y);
        this.finishDraft(inter.draft);
      } else {
        inter.pointerDown = false;
      }
      return;
    }
    if ((inter.kind === 'dragHandle' || inter.kind === 'dragDrawing') && this.dragged) {
      this.cb.onDrawingsChange?.(this.opts.drawings);
    }
    if (inter.kind === 'pan' && !inter.moved && e.pointerType !== 'mouse') {
      // tap shows crosshair on touch devices
      this.touchCrosshair = true;
      this.updateCrosshair(x, y);
    }
    if (inter.kind === 'pinch' && this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      this.inter = { kind: 'pan', startX: p.x, startY: p.y, startR: this.rightIndex, startMin: this.mainMin, startMax: this.mainMax, moved: true };
      return;
    }
    this.inter = { kind: 'none' };
    this.canvas.style.cursor = 'crosshair';
    this.requestRender();
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (this.inter.kind !== 'none' && this.inter.kind !== 'create') return;
    this.mouse = null;
    this.crossIndex = null;
    this.hoverId = null;
    this.cb.onCrosshair?.(null);
    this.requestRender();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.bars.length) return;
    const { x } = this.local(e);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
      this.rightIndex = this.clampRight(this.rightIndex + e.deltaX / this.spacing);
      this.requestRender();
      return;
    }
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
    const anchor = x >= this.plotW ? this.rightIndex : this.xToIdx(x);
    this.zoomAround(anchor, factor);
  };

  private onDblClick = (e: MouseEvent) => {
    const { x, y } = this.local(e);
    const region = this.region(x, y);
    if (region === 'price') this.setAutoScale(true);
    else if (region === 'time') this.resetView();
    this.requestRender();
  };

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
      e.preventDefault();
      this.deleteSelected();
    } else if (e.key === 'Escape') {
      if (this.inter.kind === 'create') this.inter = { kind: 'none' };
      this.measure = null;
      this.select(null);
      this.cb.onToolDone?.();
      this.requestRender();
    } else if (e.key === 'ArrowLeft') {
      this.rightIndex = this.clampRight(this.rightIndex - 3);
      this.requestRender();
    } else if (e.key === 'ArrowRight') {
      this.rightIndex = this.clampRight(this.rightIndex + 3);
      this.requestRender();
    }
  };

  private zoomAround(anchorIdx: number, factor: number) {
    const target = Math.max(0.5, Math.min(60, this.spacing * factor));
    const anchorX = this.idxToX(anchorIdx);
    this.spacing = target;
    // keep anchor index at the same x
    this.rightIndex = this.clampRight(anchorIdx - 0.5 + (this.plotW - anchorX) / this.spacing);
    this.requestRender();
  }

  private clampRight(r: number) {
    const visible = this.plotW / this.spacing;
    const min = Math.min(10, this.bars.length - 1);
    const max = this.bars.length - 1 + visible * 0.75;
    return Math.max(min, Math.min(max, r));
  }
}
