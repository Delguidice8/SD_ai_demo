// Simulated market data engine.
// Every symbol has a deterministic history (seeded from its ticker) that ends at
// the symbol's current live price, plus a live tick stream that moves prices
// and builds new bars in real time.

export interface Bar {
  t: number; // bar open time, ms since epoch
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type AssetClass = 'Crypto' | 'Stocks' | 'Forex' | 'Indices' | 'Futures';

export interface SymbolInfo {
  ticker: string;
  name: string;
  exchange: string;
  type: AssetClass;
  base: number; // reference price
  vol: number; // daily volatility (fraction)
  decimals: number;
  volume: number; // typical daily volume
}

export const SYMBOLS: SymbolInfo[] = [
  { ticker: 'BTCUSD', name: 'Bitcoin / US Dollar', exchange: 'CRYPTO', type: 'Crypto', base: 96420, vol: 0.032, decimals: 2, volume: 42_000 },
  { ticker: 'ETHUSD', name: 'Ethereum / US Dollar', exchange: 'CRYPTO', type: 'Crypto', base: 3412, vol: 0.041, decimals: 2, volume: 610_000 },
  { ticker: 'SOLUSD', name: 'Solana / US Dollar', exchange: 'CRYPTO', type: 'Crypto', base: 238.4, vol: 0.055, decimals: 2, volume: 4_800_000 },
  { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 234.9, vol: 0.016, decimals: 2, volume: 52_000_000 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'Stocks', base: 142.6, vol: 0.031, decimals: 2, volume: 240_000_000 },
  { ticker: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 338.2, vol: 0.038, decimals: 2, volume: 96_000_000 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Stocks', base: 427.1, vol: 0.014, decimals: 2, volume: 21_000_000 },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 207.8, vol: 0.019, decimals: 2, volume: 41_000_000 },
  { ticker: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 571.3, vol: 0.022, decimals: 2, volume: 13_000_000 },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', type: 'Stocks', base: 248.6, vol: 0.013, decimals: 2, volume: 9_000_000 },
  { ticker: 'SPX', name: 'S&P 500 Index', exchange: 'INDEX', type: 'Indices', base: 5987.4, vol: 0.009, decimals: 2, volume: 2_300_000_000 },
  { ticker: 'NDX', name: 'Nasdaq 100 Index', exchange: 'INDEX', type: 'Indices', base: 20841.2, vol: 0.012, decimals: 2, volume: 1_100_000_000 },
  { ticker: 'EURUSD', name: 'Euro / US Dollar', exchange: 'FX', type: 'Forex', base: 1.0548, vol: 0.005, decimals: 5, volume: 180_000 },
  { ticker: 'GBPUSD', name: 'British Pound / US Dollar', exchange: 'FX', type: 'Forex', base: 1.2611, vol: 0.0055, decimals: 5, volume: 120_000 },
  { ticker: 'USDJPY', name: 'US Dollar / Japanese Yen', exchange: 'FX', type: 'Forex', base: 151.42, vol: 0.006, decimals: 3, volume: 150_000 },
  { ticker: 'GC1!', name: 'Gold Futures', exchange: 'COMEX', type: 'Futures', base: 2672.5, vol: 0.011, decimals: 1, volume: 210_000 },
  { ticker: 'CL1!', name: 'Crude Oil Futures', exchange: 'NYMEX', type: 'Futures', base: 68.94, vol: 0.022, decimals: 2, volume: 340_000 },
];

export const symbolInfo = (ticker: string): SymbolInfo =>
  SYMBOLS.find((s) => s.ticker === ticker) ?? SYMBOLS[0];

export interface Timeframe {
  id: string;
  label: string;
  ms: number;
}

const MIN = 60_000;
export const TIMEFRAMES: Timeframe[] = [
  { id: '1', label: '1m', ms: MIN },
  { id: '5', label: '5m', ms: 5 * MIN },
  { id: '15', label: '15m', ms: 15 * MIN },
  { id: '60', label: '1H', ms: 60 * MIN },
  { id: '240', label: '4H', ms: 240 * MIN },
  { id: 'D', label: '1D', ms: 1440 * MIN },
  { id: 'W', label: '1W', ms: 7 * 1440 * MIN },
];
export const timeframe = (id: string) => TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[3];

const DAY = 86_400_000;

// ---------- deterministic randomness ----------
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const alignTime = (t: number, tfMs: number) => {
  if (tfMs === 7 * DAY) {
    // weeks start Monday 00:00 UTC (epoch was a Thursday)
    return Math.floor((t - 4 * DAY) / tfMs) * tfMs + 4 * DAY;
  }
  return Math.floor(t / tfMs) * tfMs;
};

// Build history by walking *backwards* from the given last price so every
// timeframe agrees on the current price.
export function generateHistory(info: SymbolInfo, tf: Timeframe, lastPrice: number, now: number, count = 1200): Bar[] {
  const rand = mulberry32(hash(info.ticker + tf.id));
  const scale = Math.sqrt(tf.ms / DAY);
  const sigma = info.vol * scale;
  const volPerBar = info.volume * (tf.ms / DAY);
  const bars: Bar[] = new Array(count);
  const lastT = alignTime(now, tf.ms);

  let close = lastPrice;
  let regime = gaussian(rand) * 0.06;
  let volRegime = 1;
  for (let i = count - 1; i >= 0; i--) {
    if (rand() < 0.03) regime = gaussian(rand) * 0.08;
    volRegime = Math.min(2.4, Math.max(0.5, volRegime * Math.exp(gaussian(rand) * 0.08)));
    const s = sigma * volRegime;
    const ret = regime * s + gaussian(rand) * s;
    const open = close / Math.exp(ret);
    const body = Math.abs(close - open);
    const wick = Math.max(open, close) * s * 0.45;
    const high = Math.max(open, close) + Math.abs(gaussian(rand)) * wick + body * 0.05;
    const low = Math.min(open, close) - Math.abs(gaussian(rand)) * wick - body * 0.05;
    const v = volPerBar * Math.exp(gaussian(rand) * 0.35) * (1 + Math.abs(ret) / s * 0.35);
    bars[i] = { t: lastT - (count - 1 - i) * tf.ms, o: open, h: high, l: Math.max(low, open * 0.0001), c: close, v };
    // tiny gap between bars
    close = open * Math.exp(gaussian(rand) * s * 0.03);
  }
  return bars;
}

// ---------- live feed ----------
export interface Quote {
  price: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  dayVolume: number;
}

type Listener = () => void;

class MarketFeed {
  quotes = new Map<string, Quote>();
  private listeners = new Set<Listener>();
  private rand = mulberry32(Date.now() & 0xffffffff);
  private timer: number | undefined;
  version = 0;

  constructor() {
    for (const s of SYMBOLS) {
      const r = mulberry32(hash(s.ticker + 'q'));
      const drift = (r() - 0.5) * 2 * s.vol * 1.6;
      const price = s.base;
      const prevClose = price / Math.exp(drift);
      this.quotes.set(s.ticker, {
        price,
        prevClose,
        dayHigh: Math.max(price, prevClose) * (1 + r() * s.vol * 0.4),
        dayLow: Math.min(price, prevClose) * (1 - r() * s.vol * 0.4),
        dayVolume: s.volume * (0.4 + r() * 0.5),
      });
    }
  }

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick() {
    for (const s of SYMBOLS) {
      const q = this.quotes.get(s.ticker)!;
      // per-second volatility, slightly exaggerated so the chart feels alive
      const sigma = s.vol * Math.sqrt(1 / 86400) * 3.2;
      const meanRevert = Math.log(s.base / q.price) * 0.0004;
      q.price = q.price * Math.exp(meanRevert + gaussian(this.rand) * sigma);
      q.dayHigh = Math.max(q.dayHigh, q.price);
      q.dayLow = Math.min(q.dayLow, q.price);
      q.dayVolume += (s.volume / 86400) * Math.exp(gaussian(this.rand) * 0.6);
    }
    this.version++;
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getVersion = () => this.version;

  quote(ticker: string): Quote {
    return this.quotes.get(ticker)!;
  }
}

export const feed = new MarketFeed();

// Apply the current live price to a bar series, rolling new bars when the
// timeframe boundary is crossed. Mutates and returns the array.
export function applyTick(bars: Bar[], tf: Timeframe, price: number, now: number, volumeInc: number): Bar[] {
  const last = bars[bars.length - 1];
  const t = alignTime(now, tf.ms);
  if (t > last.t) {
    bars.push({ t, o: last.c, h: Math.max(last.c, price), l: Math.min(last.c, price), c: price, v: volumeInc });
  } else {
    last.c = price;
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
    last.v += volumeInc;
  }
  return bars;
}

export function formatPrice(p: number, decimals: number) {
  if (!isFinite(p)) return '—';
  return p.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatVolume(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(0);
}

export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const c = (b.o + b.h + b.l + b.c) / 4;
    const o = i === 0 ? (b.o + b.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
    out.push({ t: b.t, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), v: b.v });
  }
  return out;
}
