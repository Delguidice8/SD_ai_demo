import type { Bar } from './market';

export type IndicatorType = 'SMA' | 'EMA' | 'BB' | 'VWAP' | 'RSI' | 'MACD' | 'STOCH' | 'ATR';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  colors: string[];
  hidden?: boolean;
}

export interface Series {
  name: string;
  values: number[]; // NaN where undefined
  color: string;
  style: 'line' | 'histogram';
  width?: number;
}

export interface IndicatorOutput {
  series: Series[];
  levels?: number[];
  range?: [number, number];
  fill?: { from: number; to: number; color: string };
}

export interface IndicatorDef {
  type: IndicatorType;
  name: string;
  description: string;
  pane: 'overlay' | 'sub';
  params: { key: string; label: string; default: number; min: number; max: number; step?: number }[];
  colors: string[];
  compute: (bars: Bar[], params: Record<string, number>, colors: string[]) => IndicatorOutput;
}

const nan = (n: number) => new Array<number>(n).fill(NaN);

export function sma(src: number[], len: number): number[] {
  const out = nan(src.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (!isNaN(v)) {
      sum += v;
      count++;
    }
    if (i >= len) {
      const old = src[i - len];
      if (!isNaN(old)) {
        sum -= old;
        count--;
      }
    }
    if (count === len) out[i] = sum / len;
  }
  return out;
}

export function ema(src: number[], len: number): number[] {
  const out = nan(src.length);
  const k = 2 / (len + 1);
  let prev = NaN;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (isNaN(v)) continue;
    if (isNaN(prev)) {
      seedSum += v;
      seedCount++;
      if (seedCount === len) {
        prev = seedSum / len;
        out[i] = prev;
      }
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rma(src: number[], len: number): number[] {
  const out = nan(src.length);
  let prev = NaN;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (isNaN(v)) continue;
    if (isNaN(prev)) {
      seedSum += v;
      seedCount++;
      if (seedCount === len) {
        prev = seedSum / len;
        out[i] = prev;
      }
    } else {
      prev = (prev * (len - 1) + v) / len;
      out[i] = prev;
    }
  }
  return out;
}

const closes = (bars: Bar[]) => bars.map((b) => b.c);

export const INDICATORS: Record<IndicatorType, IndicatorDef> = {
  SMA: {
    type: 'SMA',
    name: 'Moving Average',
    description: 'Simple moving average of closing prices',
    pane: 'overlay',
    params: [{ key: 'length', label: 'Length', default: 20, min: 1, max: 500 }],
    colors: ['#5ab0ff'],
    compute: (bars, p, c) => ({ series: [{ name: 'MA', values: sma(closes(bars), p.length), color: c[0], style: 'line', width: 1.5 }] }),
  },
  EMA: {
    type: 'EMA',
    name: 'Exponential Moving Average',
    description: 'Moving average weighted toward recent prices',
    pane: 'overlay',
    params: [{ key: 'length', label: 'Length', default: 50, min: 1, max: 500 }],
    colors: ['#f0b44c'],
    compute: (bars, p, c) => ({ series: [{ name: 'EMA', values: ema(closes(bars), p.length), color: c[0], style: 'line', width: 1.5 }] }),
  },
  BB: {
    type: 'BB',
    name: 'Bollinger Bands',
    description: 'Volatility bands around a moving average',
    pane: 'overlay',
    params: [
      { key: 'length', label: 'Length', default: 20, min: 2, max: 300 },
      { key: 'mult', label: 'StdDev', default: 2, min: 0.5, max: 5, step: 0.1 },
    ],
    colors: ['#b48cff', '#b48cff', '#b48cff'],
    compute: (bars, p, c) => {
      const src = closes(bars);
      const basis = sma(src, p.length);
      const upper = nan(src.length);
      const lower = nan(src.length);
      for (let i = p.length - 1; i < src.length; i++) {
        let s = 0;
        for (let j = i - p.length + 1; j <= i; j++) s += (src[j] - basis[i]) ** 2;
        const sd = Math.sqrt(s / p.length);
        upper[i] = basis[i] + p.mult * sd;
        lower[i] = basis[i] - p.mult * sd;
      }
      return {
        series: [
          { name: 'Basis', values: basis, color: c[0], style: 'line', width: 1 },
          { name: 'Upper', values: upper, color: c[1], style: 'line', width: 1 },
          { name: 'Lower', values: lower, color: c[2], style: 'line', width: 1 },
        ],
        fill: { from: 1, to: 2, color: c[0] },
      };
    },
  },
  VWAP: {
    type: 'VWAP',
    name: 'VWAP',
    description: 'Volume-weighted average price, anchored to each session',
    pane: 'overlay',
    params: [],
    colors: ['#3fd0c9'],
    compute: (bars, _p, c) => {
      const out = nan(bars.length);
      let pv = 0;
      let vol = 0;
      let day = -1;
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const d = Math.floor(b.t / 86_400_000);
        if (d !== day) {
          day = d;
          pv = 0;
          vol = 0;
        }
        const tp = (b.h + b.l + b.c) / 3;
        pv += tp * b.v;
        vol += b.v;
        out[i] = vol > 0 ? pv / vol : tp;
      }
      return { series: [{ name: 'VWAP', values: out, color: c[0], style: 'line', width: 1.5 }] };
    },
  },
  RSI: {
    type: 'RSI',
    name: 'Relative Strength Index',
    description: 'Momentum oscillator between 0 and 100',
    pane: 'sub',
    params: [{ key: 'length', label: 'Length', default: 14, min: 2, max: 200 }],
    colors: ['#b48cff'],
    compute: (bars, p, c) => {
      const src = closes(bars);
      const up = nan(src.length);
      const down = nan(src.length);
      for (let i = 1; i < src.length; i++) {
        const ch = src[i] - src[i - 1];
        up[i] = Math.max(ch, 0);
        down[i] = Math.max(-ch, 0);
      }
      const ru = rma(up, p.length);
      const rd = rma(down, p.length);
      const out = ru.map((u, i) => (isNaN(u) ? NaN : rd[i] === 0 ? 100 : 100 - 100 / (1 + u / rd[i])));
      return { series: [{ name: 'RSI', values: out, color: c[0], style: 'line', width: 1.5 }], levels: [30, 50, 70], range: [0, 100] };
    },
  },
  MACD: {
    type: 'MACD',
    name: 'MACD',
    description: 'Trend-following momentum from two EMAs',
    pane: 'sub',
    params: [
      { key: 'fast', label: 'Fast', default: 12, min: 1, max: 200 },
      { key: 'slow', label: 'Slow', default: 26, min: 1, max: 400 },
      { key: 'signal', label: 'Signal', default: 9, min: 1, max: 100 },
    ],
    colors: ['#5ab0ff', '#f0b44c', '#26c28b', '#f0506e'],
    compute: (bars, p, c) => {
      const src = closes(bars);
      const f = ema(src, p.fast);
      const s = ema(src, p.slow);
      const macd = f.map((v, i) => v - s[i]);
      const signal = ema(macd, p.signal);
      const hist = macd.map((v, i) => v - signal[i]);
      return {
        series: [
          { name: 'Histogram', values: hist, color: c[2] + '|' + c[3], style: 'histogram' },
          { name: 'MACD', values: macd, color: c[0], style: 'line', width: 1.5 },
          { name: 'Signal', values: signal, color: c[1], style: 'line', width: 1.5 },
        ],
        levels: [0],
      };
    },
  },
  STOCH: {
    type: 'STOCH',
    name: 'Stochastic',
    description: 'Close relative to the recent high-low range',
    pane: 'sub',
    params: [
      { key: 'k', label: '%K Length', default: 14, min: 1, max: 200 },
      { key: 'smooth', label: '%K Smoothing', default: 3, min: 1, max: 50 },
      { key: 'd', label: '%D Smoothing', default: 3, min: 1, max: 50 },
    ],
    colors: ['#5ab0ff', '#f0b44c'],
    compute: (bars, p, c) => {
      const raw = nan(bars.length);
      for (let i = p.k - 1; i < bars.length; i++) {
        let hh = -Infinity;
        let ll = Infinity;
        for (let j = i - p.k + 1; j <= i; j++) {
          hh = Math.max(hh, bars[j].h);
          ll = Math.min(ll, bars[j].l);
        }
        raw[i] = hh === ll ? 50 : ((bars[i].c - ll) / (hh - ll)) * 100;
      }
      const k = sma(raw, p.smooth);
      const d = sma(k, p.d);
      return {
        series: [
          { name: '%K', values: k, color: c[0], style: 'line', width: 1.5 },
          { name: '%D', values: d, color: c[1], style: 'line', width: 1.5 },
        ],
        levels: [20, 80],
        range: [0, 100],
      };
    },
  },
  ATR: {
    type: 'ATR',
    name: 'Average True Range',
    description: 'Average size of each bar’s full range',
    pane: 'sub',
    params: [{ key: 'length', label: 'Length', default: 14, min: 1, max: 200 }],
    colors: ['#f0506e'],
    compute: (bars, p, c) => {
      const tr = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
      return { series: [{ name: 'ATR', values: rma(tr, p.length), color: c[0], style: 'line', width: 1.5 }] };
    },
  },
};

let nextId = 1;
export function createIndicator(type: IndicatorType, overrides?: Partial<Record<string, number>>, colors?: string[]): IndicatorConfig {
  const def = INDICATORS[type];
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = overrides?.[p.key] ?? p.default;
  return { id: `${type}-${Date.now().toString(36)}-${nextId++}`, type, params, colors: colors ?? [...def.colors] };
}

export function indicatorLabel(cfg: IndicatorConfig) {
  const def = INDICATORS[cfg.type];
  const vals = def.params.map((p) => cfg.params[p.key]);
  const short = cfg.type === 'SMA' ? 'MA' : cfg.type === 'STOCH' ? 'Stoch' : cfg.type;
  return vals.length ? `${short} ${vals.join(' ')}` : short;
}
