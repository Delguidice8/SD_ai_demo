// Real market data.
//
//  • Coinbase Exchange  – crypto. Public, keyless. WebSocket ticker + REST candles.
//  • Finnhub            – stocks, ETFs, forex, metals. Free key. WebSocket trades + REST quotes.
//  • Twelve Data        – stocks, ETFs, forex, commodities. Free key. REST candles + quotes
//                         (free plan: 8 credits/minute, 800/day, so it is rationed).
//
// Anything without a working source falls back to the simulated feed in ../market.ts.

import { SYMBOLS, alignTime, feed, generateHistory, symbolInfo } from '../market';
import type { Bar, QuoteSource, SymbolInfo, Timeframe } from '../market';
import { load, save } from '../storage';

// ------------------------------------------------------------------ keys
export interface ApiKeys {
  finnhub: string;
  twelvedata: string;
}

export const getKeys = (): ApiKeys => ({ finnhub: '', twelvedata: '', ...load<Partial<ApiKeys>>('apiKeys', {}) });

export function setKeys(k: ApiKeys) {
  save('apiKeys', { finnhub: k.finnhub.trim(), twelvedata: k.twelvedata.trim() });
  historyCache.clear();
  restartProviders();
}

// ------------------------------------------------------------------ status
export type ProviderId = 'coinbase' | 'finnhub' | 'twelvedata';
export type ProviderState = 'off' | 'connecting' | 'live' | 'ok' | 'limited' | 'error';
export interface ProviderStatus {
  state: ProviderState;
  detail: string;
}

const status: Record<ProviderId, ProviderStatus> = {
  coinbase: { state: 'connecting', detail: 'Connecting…' },
  finnhub: { state: 'off', detail: 'No API key' },
  twelvedata: { state: 'off', detail: 'No API key' },
};
let statusVersion = 0;
const statusListeners = new Set<() => void>();

function setStatus(id: ProviderId, state: ProviderState, detail: string) {
  if (status[id].state === state && status[id].detail === detail) return;
  status[id] = { state, detail };
  statusVersion++;
  statusListeners.forEach((l) => l());
}

export const providerStatus = {
  get: () => status,
  version: () => statusVersion,
  subscribe: (l: () => void) => {
    statusListeners.add(l);
    return () => {
      statusListeners.delete(l);
    };
  },
};

// ------------------------------------------------------------------ helpers
const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

// ------------------------------------------------------------------ lifecycle
let generation = 0; // bumps on restart so stale loops stop
let activeTicker = 'BTCUSD';
const cleanups: (() => void)[] = [];

export function setActiveSymbol(t: string) {
  const changed = activeTicker !== t;
  activeTicker = t;
  if (changed) tdPollActive(generation);
}

export function startProviders() {
  restartProviders();
}

export function stopProviders() {
  generation++;
  while (cleanups.length) cleanups.pop()!();
}

function restartProviders() {
  stopProviders();
  const gen = generation;
  const keys = getKeys();
  startCoinbase(gen);
  if (keys.finnhub) startFinnhub(gen, keys.finnhub);
  else setStatus('finnhub', 'off', 'No API key');
  if (keys.twelvedata) startTwelveData(gen);
  else setStatus('twelvedata', 'off', 'No API key');
}

// ================================================================== Coinbase
const CB_REST = 'https://api.exchange.coinbase.com';
const CB_WS = 'wss://ws-feed.exchange.coinbase.com';

function startCoinbase(gen: number) {
  const products = SYMBOLS.filter((s) => s.cb);
  const byProduct = new Map(products.map((s) => [s.cb!, s.ticker]));
  let ws: WebSocket | null = null;
  let retry = 0;
  let timer: number | undefined;

  const connect = () => {
    if (gen !== generation) return;
    setStatus('coinbase', 'connecting', 'Connecting…');
    try {
      ws = new WebSocket(CB_WS);
    } catch {
      setStatus('coinbase', 'error', 'WebSocket unavailable');
      return;
    }
    ws.onopen = () => {
      retry = 0;
      ws!.send(JSON.stringify({ type: 'subscribe', product_ids: [...byProduct.keys()], channels: ['ticker'] }));
    };
    ws.onmessage = (ev) => {
      let m: Record<string, string>;
      try {
        m = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (m.type === 'subscriptions') setStatus('coinbase', 'live', 'Streaming real-time');
      if (m.type === 'error') setStatus('coinbase', 'error', m.message ?? 'Error');
      if (m.type !== 'ticker') return;
      const ticker = byProduct.get(m.product_id);
      const price = num(m.price);
      if (!ticker || !(price > 0)) return;
      setStatus('coinbase', 'live', 'Streaming real-time');
      feed.update(ticker, {
        price,
        prevClose: num(m.open_24h) || undefined,
        dayHigh: num(m.high_24h) || undefined,
        dayLow: num(m.low_24h) || undefined,
        dayVolume: num(m.volume_24h) || undefined,
        size: num(m.last_size) || 0,
        time: m.time ? Date.parse(m.time) : Date.now(),
        source: 'coinbase',
        streaming: true,
        marketOpen: true,
      });
    };
    ws.onclose = () => {
      if (gen !== generation) return;
      setStatus('coinbase', 'error', 'Disconnected, retrying…');
      retry = Math.min(retry + 1, 6);
      timer = window.setTimeout(connect, 1000 * 2 ** retry);
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  cleanups.push(() => {
    window.clearTimeout(timer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  });
}

const CB_GRAN: Record<string, { g: number; agg: number }> = {
  '1': { g: 60, agg: 0 },
  '5': { g: 300, agg: 0 },
  '15': { g: 900, agg: 0 },
  '60': { g: 3600, agg: 0 },
  '240': { g: 3600, agg: 4 * 3600_000 },
  D: { g: 86400, agg: 0 },
  W: { g: 86400, agg: 7 * 86400_000 },
};

function aggregate(bars: Bar[], tfMs: number): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const t = alignTime(b.t, tfMs);
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else out.push({ ...b, t });
  }
  return out;
}

async function coinbaseHistory(info: SymbolInfo, tf: Timeframe, signal?: AbortSignal): Promise<Bar[]> {
  const { g, agg } = CB_GRAN[tf.id];
  const pages = 4; // 300 candles per request
  const spanMs = 300 * g * 1000;
  const end = Date.now();
  const reqs = Array.from({ length: pages }, (_, i) => {
    const e = new Date(end - i * spanMs).toISOString();
    const s = new Date(end - (i + 1) * spanMs).toISOString();
    return getJson<number[][]>(`${CB_REST}/products/${info.cb}/candles?granularity=${g}&start=${s}&end=${e}`, signal).catch((err) => {
      if (i === 0) throw err; // older pages are optional
      return [] as number[][];
    });
  });
  const rows = (await Promise.all(reqs)).flat();
  const seen = new Set<number>();
  const bars: Bar[] = [];
  for (const [time, low, high, open, close, volume] of rows) {
    const t = time * 1000;
    if (seen.has(t)) continue;
    seen.add(t);
    bars.push({ t, o: open, h: high, l: low, c: close, v: volume });
  }
  bars.sort((a, b) => a.t - b.t);
  return agg ? aggregate(bars, agg) : bars;
}

// ================================================================== Finnhub
const FH_REST = 'https://finnhub.io/api/v1';
const FH_WS = 'wss://ws.finnhub.io';

interface FhQuote {
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

function startFinnhub(gen: number, key: string) {
  const syms = SYMBOLS.filter((s) => s.fh);
  const bySym = new Map(syms.map((s) => [s.fh!, s.ticker]));
  let ws: WebSocket | null = null;
  let retry = 0;
  let timer: number | undefined;
  setStatus('finnhub', 'connecting', 'Connecting…');

  // REST quotes: previous close, day range, and the last price while markets are closed.
  const pollQuotes = async () => {
    let ok = 0;
    for (const s of syms) {
      if (gen !== generation) return;
      try {
        const q = await getJson<FhQuote>(`${FH_REST}/quote?symbol=${encodeURIComponent(s.fh!)}&token=${encodeURIComponent(key)}`);
        if (q && q.c > 0) {
          ok++;
          const cur = feed.quote(s.ticker);
          // keep a fresher streamed price if we have one
          const fresher = cur.source === 'finnhub' && cur.streaming && cur.time > q.t * 1000;
          feed.update(s.ticker, {
            ...(fresher ? {} : { price: q.c, time: q.t * 1000 }),
            prevClose: q.pc || undefined,
            dayHigh: q.h || undefined,
            dayLow: q.l || undefined,
            source: 'finnhub',
            streaming: true,
          });
        }
      } catch (e) {
        if (e instanceof HttpError && (e.code === 401 || e.code === 403)) {
          setStatus('finnhub', 'error', 'API key rejected');
          return;
        }
        if (e instanceof HttpError && e.code === 429) {
          setStatus('finnhub', 'limited', 'Rate limited, slowing down');
          await sleep(5000);
        }
      }
      await sleep(250);
    }
    if (ok > 0 && status.finnhub.state !== 'live') setStatus('finnhub', 'ok', `Quotes for ${ok} symbols`);
  };
  pollQuotes();
  const quoteTimer = window.setInterval(pollQuotes, 120_000);

  const connect = () => {
    if (gen !== generation) return;
    try {
      ws = new WebSocket(`${FH_WS}?token=${encodeURIComponent(key)}`);
    } catch {
      setStatus('finnhub', 'error', 'WebSocket unavailable');
      return;
    }
    ws.onopen = () => {
      retry = 0;
      for (const s of bySym.keys()) ws!.send(JSON.stringify({ type: 'subscribe', symbol: s }));
      setStatus('finnhub', 'live', 'Streaming real-time');
    };
    ws.onmessage = (ev) => {
      let m: { type: string; data?: { s: string; p: number; t: number; v: number }[]; msg?: string };
      try {
        m = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (m.type === 'error') {
        setStatus('finnhub', 'error', m.msg ?? 'Stream error');
        return;
      }
      if (m.type !== 'trade' || !m.data) return;
      // keep only the latest trade per symbol in this batch, but sum the size
      const latest = new Map<string, { p: number; t: number; v: number }>();
      for (const tr of m.data) {
        const prev = latest.get(tr.s);
        latest.set(tr.s, { p: tr.t >= (prev?.t ?? 0) ? tr.p : prev!.p, t: Math.max(tr.t, prev?.t ?? 0), v: (prev?.v ?? 0) + (tr.v || 0) });
      }
      for (const [s, tr] of latest) {
        const ticker = bySym.get(s);
        if (!ticker || !(tr.p > 0)) continue;
        feed.update(ticker, { price: tr.p, time: tr.t, size: tr.v, source: 'finnhub', streaming: true, marketOpen: true });
      }
    };
    ws.onclose = (ev) => {
      if (gen !== generation) return;
      if (ev.code === 1008 || ev.code === 4001) {
        setStatus('finnhub', 'error', 'API key rejected');
        return;
      }
      setStatus('finnhub', 'error', 'Disconnected, retrying…');
      retry = Math.min(retry + 1, 6);
      timer = window.setTimeout(connect, 1000 * 2 ** retry);
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  cleanups.push(() => {
    window.clearTimeout(timer);
    window.clearInterval(quoteTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  });
}

// ================================================================== Twelve Data
const TD_REST = 'https://api.twelvedata.com';
const TD_INTERVAL: Record<string, string> = { '1': '1min', '5': '5min', '15': '15min', '60': '1h', '240': '4h', D: '1day', W: '1week' };

// Free plan: 8 credits per rolling minute. One credit per symbol per request.
// Background quote polling may only use 6 of them, so loading a chart is never
// stuck behind it.
const TD_RESERVED = 2;
const tdLimiter = {
  perMin: 8,
  used: [] as number[],
  pausedUntil: 0,
  async take(n: number, background: boolean) {
    for (;;) {
      const now = Date.now();
      this.used = this.used.filter((t) => now - t < 61_000);
      const cap = background ? this.perMin - TD_RESERVED : this.perMin;
      if (now >= this.pausedUntil && this.used.length + n <= cap) {
        for (let i = 0; i < n; i++) this.used.push(now);
        return;
      }
      const wait = Math.max(this.pausedUntil - now, this.used.length ? 61_000 - (now - this.used[0]) : 1000);
      await sleep(Math.max(250, wait));
    }
  },
};

interface TdError {
  status?: string;
  code?: number;
  message?: string;
}

async function tdGet<T>(path: string, credits: number, signal?: AbortSignal, background = false): Promise<T> {
  const key = getKeys().twelvedata;
  if (!key) throw new Error('No Twelve Data key');
  await tdLimiter.take(credits, background);
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${TD_REST}${path}${sep}apikey=${encodeURIComponent(key)}`, { signal });
  const body = (await res.json().catch(() => ({}))) as T & TdError;
  const code = body.code ?? (res.ok ? 0 : res.status);
  if (body.status === 'error' || code >= 400) {
    if (code === 429) {
      tdLimiter.pausedUntil = Date.now() + 65_000;
      setStatus('twelvedata', 'limited', /day|daily/i.test(body.message ?? '') ? 'Daily credit limit reached' : 'Rate limited, waiting a minute');
    } else if (code === 401 || code === 403) {
      setStatus('twelvedata', 'error', 'API key rejected or symbol not on your plan');
    }
    throw new HttpError(body.message ?? `HTTP ${code}`, code);
  }
  if (status.twelvedata.state !== 'ok') setStatus('twelvedata', 'ok', 'Connected');
  return body as T;
}

interface TdQuote {
  symbol: string;
  close: string;
  previous_close: string;
  high: string;
  low: string;
  volume?: string;
  timestamp: number;
  last_quote_at?: number;
  is_market_open: boolean;
}

function applyTdQuote(q: TdQuote) {
  const s = SYMBOLS.find((x) => x.td === q.symbol);
  const price = num(q.close);
  if (!s || !(price > 0)) return;
  const cur = feed.quote(s.ticker);
  if (cur.source === 'finnhub' || cur.source === 'coinbase') {
    // a streaming source is in charge; only fill in missing daily fields
    if (!(cur.prevClose > 0)) feed.update(s.ticker, { prevClose: num(q.previous_close) });
    return;
  }
  feed.update(s.ticker, {
    price,
    prevClose: num(q.previous_close) || undefined,
    dayHigh: num(q.high) || undefined,
    dayLow: num(q.low) || undefined,
    dayVolume: num(q.volume) || undefined,
    time: (q.last_quote_at ?? q.timestamp) * 1000,
    source: 'twelvedata',
    streaming: false,
    marketOpen: q.is_market_open,
  });
}

async function tdQuotes(symbols: string[]) {
  const size = 8 - TD_RESERVED;
  for (let i = 0; i < symbols.length; i += size) {
    const chunk = symbols.slice(i, i + size);
    const body = await tdGet<TdQuote | Record<string, TdQuote>>(`/quote?symbol=${encodeURIComponent(chunk.join(','))}`, chunk.length, undefined, true);
    const list: TdQuote[] = chunk.length === 1 ? [body as TdQuote] : Object.values(body as Record<string, TdQuote>);
    for (const q of list) if (q && (q as TdQuote & TdError).status !== 'error') applyTdQuote(q);
  }
}

/** Symbols Twelve Data should poll: those not covered by a streaming source. */
function tdNeeds(): string[] {
  return SYMBOLS.filter((s) => {
    if (!s.td) return false;
    const q = feed.quote(s.ticker);
    return !(q.source === 'finnhub' || q.source === 'coinbase');
  }).map((s) => s.td!);
}

function tdPollActive(gen: number) {
  const info = symbolInfo(activeTicker);
  if (gen !== generation || !info.td || !getKeys().twelvedata || !tdNeeds().includes(info.td)) return;
  tdQuotes([info.td])
    .then(() => gen === generation && setStatus('twelvedata', 'ok', 'Polling quotes (free plan: ~1/min)'))
    .catch(() => {});
}

function startTwelveData(gen: number) {
  setStatus('twelvedata', 'connecting', 'Loading quotes…');
  let activeTimer: number | undefined;
  let allTimer: number | undefined;
  const refreshAll = () => {
    if (gen !== generation) return;
    const needs = tdNeeds();
    if (!needs.length) {
      setStatus('twelvedata', 'ok', 'History only (live prices from Finnhub)');
      return;
    }
    tdQuotes(needs)
      .then(() => gen === generation && setStatus('twelvedata', 'ok', 'Polling quotes (free plan: ~1/min)'))
      .catch(() => {});
  };
  // give Finnhub a few seconds to claim symbols first, so credits aren't wasted
  const startTimer = window.setTimeout(refreshAll, getKeys().finnhub ? 6000 : 300);
  activeTimer = window.setInterval(() => tdPollActive(gen), 60_000);
  allTimer = window.setInterval(refreshAll, 15 * 60_000);
  cleanups.push(() => {
    window.clearTimeout(startTimer);
    window.clearInterval(activeTimer);
    window.clearInterval(allTimer);
    activeTimer = allTimer = undefined;
  });
}

async function twelveDataHistory(info: SymbolInfo, tf: Timeframe, signal?: AbortSignal): Promise<Bar[]> {
  interface Row {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }
  const body = await tdGet<{ values: Row[] }>(
    `/time_series?symbol=${encodeURIComponent(info.td!)}&interval=${TD_INTERVAL[tf.id]}&outputsize=1000&timezone=UTC`,
    1,
    signal,
  );
  const parse = (s: string) => Date.parse(s.length <= 10 ? `${s}T00:00:00Z` : `${s.replace(' ', 'T')}Z`);
  return body.values
    .map((r) => ({ t: parse(r.datetime), o: num(r.open), h: num(r.high), l: num(r.low), c: num(r.close), v: num(r.volume) || 0 }))
    .filter((b) => isFinite(b.t) && b.c > 0)
    .sort((a, b) => a.t - b.t);
}

// ================================================================== history
export interface HistoryResult {
  bars: Bar[];
  source: QuoteSource;
  note?: string;
}

const historyCache = new Map<string, { at: number; res: HistoryResult }>();
const copy = (r: HistoryResult): HistoryResult => ({ ...r, bars: r.bars.map((b) => ({ ...b })) });

/** Load candles for a symbol: real where a source is available, simulated otherwise. */
export async function loadHistory(ticker: string, tf: Timeframe, signal?: AbortSignal): Promise<HistoryResult> {
  const info = symbolInfo(ticker);
  const key = `${ticker}|${tf.id}`;
  const cached = historyCache.get(key);
  const ttl = info.cb ? 30_000 : 5 * 60_000;
  if (cached && Date.now() - cached.at < ttl) return copy(cached.res);

  let res: HistoryResult | null = null;
  let note: string | undefined;
  try {
    if (info.cb) {
      res = { bars: await coinbaseHistory(info, tf, signal), source: 'coinbase' };
    } else if (info.td && getKeys().twelvedata) {
      res = { bars: await twelveDataHistory(info, tf, signal), source: 'twelvedata' };
    } else {
      note = 'Add a Twelve Data key for real price history';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    note = `Real history unavailable (${(e as Error).message}); showing simulated bars`;
  }

  if (res && res.bars.length > 1) {
    // seed the quote from history if no live source has reported yet
    const last = res.bars[res.bars.length - 1];
    const q = feed.quote(ticker);
    if (q.source === 'sim') {
      const dayAgo = res.bars.find((b) => b.t >= last.t - 86_400_000) ?? res.bars[0];
      feed.update(ticker, { price: last.c, prevClose: dayAgo.o, dayHigh: last.h, dayLow: last.l, time: last.t, source: res.source, streaming: false });
    }
    historyCache.set(key, { at: Date.now(), res });
    return copy(res);
  }

  const q = feed.quote(ticker);
  return { bars: generateHistory(info, tf, q.price, Date.now()), source: 'sim', note: note ?? 'Simulated data' };
}
