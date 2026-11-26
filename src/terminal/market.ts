// Market model: symbol universe, timeframes, the live quote feed, and a
// simulated fallback used whenever a symbol has no real data source.
// Real data is pushed into the feed by ./data/providers.ts.

export interface Bar {
  t: number; // bar open time, ms since epoch (UTC)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type AssetClass = 'Crypto' | 'Stocks' | 'ETFs' | 'Forex' | 'Commodities';

export interface SymbolInfo {
  ticker: string;
  name: string;
  exchange: string;
  type: AssetClass;
  base: number; // fallback reference price for simulation
  vol: number; // daily volatility (fraction), used for simulation
  decimals: number;
  volume: number; // typical daily volume, used for simulation
  /** Coinbase Exchange product id (crypto, keyless). */
  cb?: string;
  /** Twelve Data symbol (history + polled quotes). */
  td?: string;
  /** Finnhub symbol (real-time trades + quotes). */
  fh?: string;
  /** Trades around the clock (no market-hours gaps). */
  allDay?: boolean;
}

export const SYMBOLS: SymbolInfo[] = [
  { ticker: 'BTCUSD', name: 'Bitcoin / US Dollar', exchange: 'COINBASE', type: 'Crypto', base: 60000, vol: 0.032, decimals: 2, volume: 16_000, cb: 'BTC-USD', allDay: true },
  { ticker: 'ETHUSD', name: 'Ethereum / US Dollar', exchange: 'COINBASE', type: 'Crypto', base: 2400, vol: 0.041, decimals: 2, volume: 250_000, cb: 'ETH-USD', allDay: true },
  { ticker: 'SOLUSD', name: 'Solana / US Dollar', exchange: 'COINBASE', type: 'Crypto', base: 71, vol: 0.055, decimals: 2, volume: 1_600_000, cb: 'SOL-USD', allDay: true },
  { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 355, vol: 0.016, decimals: 2, volume: 52_000_000, td: 'AAPL', fh: 'AAPL' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'Stocks', base: 180, vol: 0.031, decimals: 2, volume: 240_000_000, td: 'NVDA', fh: 'NVDA' },
  { ticker: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 400, vol: 0.038, decimals: 2, volume: 96_000_000, td: 'TSLA', fh: 'TSLA' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Stocks', base: 480, vol: 0.014, decimals: 2, volume: 21_000_000, td: 'MSFT', fh: 'MSFT' },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 230, vol: 0.019, decimals: 2, volume: 41_000_000, td: 'AMZN', fh: 'AMZN' },
  { ticker: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', type: 'Stocks', base: 650, vol: 0.022, decimals: 2, volume: 13_000_000, td: 'META', fh: 'META' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', type: 'Stocks', base: 290, vol: 0.013, decimals: 2, volume: 9_000_000, td: 'JPM', fh: 'JPM' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE ARCA', type: 'ETFs', base: 650, vol: 0.009, decimals: 2, volume: 60_000_000, td: 'SPY', fh: 'SPY' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)', exchange: 'NASDAQ', type: 'ETFs', base: 580, vol: 0.012, decimals: 2, volume: 40_000_000, td: 'QQQ', fh: 'QQQ' },
  { ticker: 'EURUSD', name: 'Euro / US Dollar', exchange: 'FX', type: 'Forex', base: 1.097, vol: 0.005, decimals: 5, volume: 0, td: 'EUR/USD', fh: 'OANDA:EUR_USD' },
  { ticker: 'GBPUSD', name: 'British Pound / US Dollar', exchange: 'FX', type: 'Forex', base: 1.30, vol: 0.0055, decimals: 5, volume: 0, td: 'GBP/USD', fh: 'OANDA:GBP_USD' },
  { ticker: 'USDJPY', name: 'US Dollar / Japanese Yen', exchange: 'FX', type: 'Forex', base: 150, vol: 0.006, decimals: 3, volume: 0, td: 'USD/JPY', fh: 'OANDA:USD_JPY' },
  { ticker: 'XAUUSD', name: 'Gold Spot / US Dollar', exchange: 'SPOT', type: 'Commodities', base: 2700, vol: 0.011, decimals: 2, volume: 0, td: 'XAU/USD', fh: 'OANDA:XAU_USD' },
  { ticker: 'WTIUSD', name: 'Crude Oil WTI Spot', exchange: 'SPOT', type: 'Commodities', base: 68, vol: 0.022, decimals: 2, volume: 0, td: 'WTI/USD', fh: 'OANDA:WTICO_USD' },
];

/** Tickers renamed since earlier versions (for saved watchlists/drawings). */
export const RENAMED: Record<string, string> = { SPX: 'SPY', NDX: 'QQQ', 'GC1!': 'XAUUSD', 'CL1!': 'WTIUSD' };

export const isKnownSymbol = (t: string) => SYMBOLS.some((s) => s.ticker === t);
export const symbolInfo = (ticker: string): SymbolInfo => SYMBOLS.find((s) => s.ticker === ticker) ?? SYMBOLS[0];

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

// Simulated history, walked *backwards* from the given last price so it
// always ends at the symbol's current quote.
export function generateHistory(info: SymbolInfo, tf: Timeframe, lastPrice: number, now: number, count = 1200): Bar[] {
  const rand = mulberry32(hash(info.ticker + tf.id));
  const scale = Math.sqrt(tf.ms / DAY);
  const sigma = info.vol * scale;
  const volPerBar = (info.volume || 1000) * (tf.ms / DAY);
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
    const v = volPerBar * Math.exp(gaussian(rand) * 0.35) * (1 + (Math.abs(ret) / s) * 0.35);
    bars[i] = { t: lastT - (count - 1 - i) * tf.ms, o: open, h: high, l: Math.max(low, open * 0.0001), c: close, v };
    close = open * Math.exp(gaussian(rand) * s * 0.03);
  }
  return bars;
}

// ---------- live feed ----------
export type QuoteSource = 'coinbase' | 'finnhub' | 'twelvedata' | 'sim';

export interface Quote {
  price: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  dayVolume: number;
  /** Running total of traded size seen by the feed (drives the live bar's volume). */
  cumVolume: number;
  /** Time of the last price update, ms. */
  time: number;
  source: QuoteSource;
  /** True for streaming sources, false for polled ones. */
  streaming: boolean;
  /** Whether the regular market session is open (undefined if unknown). */
  marketOpen?: boolean;
}

type Listener = () => void;

class MarketFeed {
  quotes = new Map<string, Quote>();
  private listeners = new Set<Listener>();
  private rand = mulberry32(Date.now() & 0xffffffff);
  private timer: number | undefined;
  private notifyTimer: number | undefined;
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
        cumVolume: 0,
        time: Date.now(),
        source: 'sim',
        streaming: false,
      });
    }
  }

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.simTick(), 1000);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  // Simulated movement only for symbols that have no real source.
  private simTick() {
    let moved = false;
    const now = Date.now();
    for (const s of SYMBOLS) {
      const q = this.quotes.get(s.ticker)!;
      if (q.source !== 'sim') continue;
      const sigma = s.vol * Math.sqrt(1 / 86400) * 3.2;
      const meanRevert = Math.log(s.base / q.price) * 0.0004;
      q.price = q.price * Math.exp(meanRevert + gaussian(this.rand) * sigma);
      q.dayHigh = Math.max(q.dayHigh, q.price);
      q.dayLow = Math.min(q.dayLow, q.price);
      const inc = ((s.volume || 1000) / 86400) * Math.exp(gaussian(this.rand) * 0.6);
      q.dayVolume += inc;
      q.cumVolume += inc;
      q.time = now;
      moved = true;
    }
    if (moved) this.notify();
  }

  /** Push a real price update. Fields left out keep their current values. */
  update(ticker: string, patch: Partial<Omit<Quote, 'cumVolume'>> & { size?: number }) {
    const q = this.quotes.get(ticker);
    if (!q) return;
    const { size, ...rest } = patch;
    Object.assign(q, rest);
    if (patch.price !== undefined) {
      if (!(q.dayHigh >= q.price)) q.dayHigh = q.price;
      if (!(q.dayLow <= q.price) || q.dayLow <= 0) q.dayLow = q.price;
    }
    if (size && size > 0) q.cumVolume += size;
    this.notify();
  }

  /** Coalesce bursts of ticks into at most ~5 renders per second. */
  notify() {
    if (this.notifyTimer) return;
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = undefined;
      this.version++;
      this.listeners.forEach((l) => l());
    }, 200);
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getVersion = () => this.version;

  quote(ticker: string): Quote {
    return this.quotes.get(ticker) ?? this.quotes.get(SYMBOLS[0].ticker)!;
  }
}

export const feed = new MarketFeed();

/**
 * Apply a price update to a bar series. New bars are anchored to the last
 * bar's open time so session gaps (nights, weekends) are respected.
 * Mutates and returns the array.
 */
export function applyTick(bars: Bar[], tf: Timeframe, price: number, time: number, volumeInc: number): Bar[] {
  const last = bars[bars.length - 1];
  if (!last || time < last.t) return bars;
  if (time >= last.t + tf.ms) {
    const steps = Math.floor((time - last.t) / tf.ms);
    // daily/weekly bars snap to calendar boundaries; intraday follow the series' own phase
    const t = tf.ms >= DAY ? alignTime(time, tf.ms) : last.t + steps * tf.ms;
    if (t <= last.t) return bars;
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
