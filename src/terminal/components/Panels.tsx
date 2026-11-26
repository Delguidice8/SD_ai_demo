import { useMemo, useRef, useState } from 'react';
import { Bell, BellRing, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { SymbolBadge } from './ui';
import { feed, formatPrice, formatVolume, generateHistory, symbolInfo, timeframe } from '../market';
import type { Account, PriceAlert } from '../trading';
import { STARTING_CASH, equity, unrealized } from '../trading';

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const money = (v: number, sign = false) =>
  `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- Watchlist
export function Watchlist({
  list,
  active,
  onSelect,
  onRemove,
  onAdd,
}: {
  list: string[];
  active: string;
  onSelect: (t: string) => void;
  onRemove: (t: string) => void;
  onAdd: () => void;
}) {
  const prev = useRef(new Map<string, number>());
  const dirs = useRef(new Map<string, number>());
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h3 className="text-[13px] font-semibold text-t-text">Watchlist</h3>
        <button onClick={onAdd} title="Add symbol" className="rounded-md p-1 text-t-muted hover:bg-t-hover hover:text-t-text">
          <Plus size={16} />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-t-border px-4 pb-1.5 text-[11px] font-medium text-t-faint">
        <span>Symbol</span>
        <span className="w-20 text-right">Last</span>
        <span className="w-16 text-right">Chg%</span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
        {list.map((t) => {
          const info = symbolInfo(t);
          const q = feed.quote(t);
          const p0 = prev.current.get(t);
          if (p0 !== undefined && p0 !== q.price) dirs.current.set(t, q.price > p0 ? 1 : -1);
          prev.current.set(t, q.price);
          const dir = dirs.current.get(t) ?? 0;
          const ch = ((q.price - q.prevClose) / q.prevClose) * 100;
          return (
            <div
              key={t}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(t)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(t)}
              className={`group relative grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2 ${
                t === active ? 'bg-t-hover' : 'hover:bg-t-hover/60'
              }`}
            >
              {t === active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-t-accent" />}
              <div className="flex min-w-0 items-center gap-2.5">
                <SymbolBadge ticker={t} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-t-text">{t}</div>
                  <div className="truncate text-[11px] text-t-faint">{info.name}</div>
                </div>
              </div>
              <span
                key={q.price}
                className={`w-20 rounded px-1 text-right text-[13px] tnum text-t-text ${dir > 0 ? 'flash-up' : dir < 0 ? 'flash-down' : ''}`}
              >
                {formatPrice(q.price, info.decimals)}
              </span>
              <span className={`w-16 text-right text-[12px] font-medium tnum ${ch >= 0 ? 'text-t-up' : 'text-t-down'}`}>{pct(ch)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t);
                }}
                title="Remove from watchlist"
                className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded bg-t-elev p-0.5 text-t-faint shadow hover:text-t-down group-hover:block"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Details
export function SymbolDetails({ ticker }: { ticker: string }) {
  const info = symbolInfo(ticker);
  const q = feed.quote(ticker);
  const ch = q.price - q.prevClose;
  const chPct = (ch / q.prevClose) * 100;

  const perf = useMemo(() => {
    const now = Date.now();
    const daily = generateHistory(info, timeframe('D'), feed.quote(ticker).price, now, 400);
    const last = daily[daily.length - 1].c;
    const back = (n: number) => daily[Math.max(0, daily.length - 1 - n)].c;
    const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
    const ytdBar = daily.find((b) => b.t >= jan1) ?? daily[0];
    const yr = daily.slice(-365);
    return {
      rows: [
        ['1W', back(7)],
        ['1M', back(30)],
        ['3M', back(90)],
        ['6M', back(182)],
        ['YTD', ytdBar.o],
        ['1Y', back(365)],
      ].map(([l, p]) => [l as string, ((last - (p as number)) / (p as number)) * 100] as const),
      hi52: Math.max(...yr.map((b) => b.h)),
      lo52: Math.min(...yr.map((b) => b.l)),
    };
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const rangePos = Math.max(0, Math.min(1, (q.price - q.dayLow) / (q.dayHigh - q.dayLow || 1)));
  const fmt = (v: number) => formatPrice(v, info.decimals);

  return (
    <div className="border-t border-t-border px-4 py-4">
      <div className="flex items-center gap-2.5">
        <SymbolBadge ticker={ticker} size={28} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-t-text">
            {ticker}
            <span className="rounded bg-t-hover px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-t-muted">{info.type}</span>
          </div>
          <div className="truncate text-[12px] text-t-muted">
            {info.name} · {info.exchange}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold leading-none tracking-tight text-t-text tnum">{fmt(q.price)}</span>
        <span className={`text-[13px] font-medium tnum ${ch >= 0 ? 'text-t-up' : 'text-t-down'}`}>
          {ch >= 0 ? '+' : ''}
          {fmt(ch)} ({pct(chPct)})
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-t-faint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-t-up" /> Live · simulated feed
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-t-faint">
          <span>Day’s range</span>
        </div>
        <div className="relative h-1 rounded-full bg-t-hover">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-t-down via-t-accent to-t-up" style={{ width: `${rangePos * 100}%` }} />
          <div className="absolute -top-1 h-3 w-0.5 rounded bg-t-text" style={{ left: `calc(${rangePos * 100}% - 1px)` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] tnum text-t-muted">
          <span>{fmt(q.dayLow)}</span>
          <span>{fmt(q.dayHigh)}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        {[
          ['Prev close', fmt(q.prevClose)],
          ['Volume', formatVolume(q.dayVolume)],
          ['52W high', fmt(perf.hi52)],
          ['52W low', fmt(perf.lo52)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-t-faint">{k}</dt>
            <dd className="text-t-text tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {perf.rows.map(([l, v]) => (
          <div key={l} className={`rounded-md px-2 py-1.5 text-center ${v >= 0 ? 'bg-t-up/10' : 'bg-t-down/10'}`}>
            <div className={`text-[12px] font-semibold tnum ${v >= 0 ? 'text-t-up' : 'text-t-down'}`}>{pct(v)}</div>
            <div className="text-[10px] font-medium text-t-faint">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Trade
export function TradePanel({
  ticker,
  account,
  onOrder,
  onClose,
  onReset,
  onSelect,
}: {
  ticker: string;
  account: Account;
  onOrder: (side: 'buy' | 'sell', qty: number) => void;
  onClose: (t: string) => void;
  onReset: () => void;
  onSelect: (t: string) => void;
}) {
  const info = symbolInfo(ticker);
  const price = feed.quote(ticker).price;
  const defaultQty = price > 10000 ? 0.1 : price > 1000 ? 1 : price < 5 ? 1000 : 10;
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qtyStr, setQtyStr] = useState(String(defaultQty));
  const [lastTicker, setLastTicker] = useState(ticker);
  if (lastTicker !== ticker) {
    setLastTicker(ticker);
    setQtyStr(String(defaultQty));
  }
  const qty = Math.max(0, Number(qtyStr) || 0);
  const step = defaultQty;
  const cost = qty * price;
  const priceOf = (t: string) => feed.quote(t).price;
  const eq = equity(account, priceOf);
  const totalPnl = eq - STARTING_CASH;
  const positions = Object.values(account.positions);
  const openPnl = positions.reduce((s, p) => s + unrealized(p, priceOf(p.ticker)), 0);

  return (
    <div className="t-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-4 pt-3">
        <div className="rounded-xl border border-t-border bg-gradient-to-br from-t-hover/70 to-transparent p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-t-faint">Paper account</span>
            <button onClick={onReset} title="Reset account" className="rounded p-1 text-t-faint hover:bg-t-hover hover:text-t-text">
              <RotateCcw size={13} />
            </button>
          </div>
          <div className="mt-1 text-[22px] font-semibold tracking-tight text-t-text tnum">{money(eq)}</div>
          <div className={`text-[12px] font-medium tnum ${totalPnl >= 0 ? 'text-t-up' : 'text-t-down'}`}>
            {money(totalPnl, true)} ({pct((totalPnl / STARTING_CASH) * 100)}) all time
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <div className="text-t-faint">Cash</div>
              <div className="text-t-text tnum">{money(account.cash)}</div>
            </div>
            <div>
              <div className="text-t-faint">Open P&amp;L</div>
              <div className={`tnum ${openPnl >= 0 ? 'text-t-up' : 'text-t-down'}`}>{money(openPnl, true)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-t-hover p-1">
          {(['buy', 'sell'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`rounded-md py-1.5 text-[13px] font-semibold capitalize transition-colors ${
                side === s ? (s === 'buy' ? 'bg-t-up text-white shadow' : 'bg-t-down text-white shadow') : 'text-t-muted hover:text-t-text'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[11px] font-medium text-t-faint">Quantity</label>
        <div className="mt-1 flex items-center rounded-lg border border-t-border bg-t-bg focus-within:border-t-accent">
          <button onClick={() => setQtyStr(String(Math.max(0, +(qty - step).toFixed(6))))} className="p-2.5 text-t-muted hover:text-t-text" aria-label="Decrease">
            <Minus size={14} />
          </button>
          <input
            inputMode="decimal"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value.replace(/[^0-9.]/g, ''))}
            className="h-9 w-full bg-transparent text-center text-[14px] font-medium text-t-text tnum outline-none"
          />
          <button onClick={() => setQtyStr(String(+(qty + step).toFixed(6)))} className="p-2.5 text-t-muted hover:text-t-text" aria-label="Increase">
            <Plus size={14} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {[0.1, 0.25, 0.5, 1].map((f) => (
            <button
              key={f}
              onClick={() => setQtyStr(String(+((Math.max(0, account.cash) * f) / price).toFixed(info.type === 'Crypto' ? 4 : 0)))}
              className="rounded-md border border-t-border py-1 text-[11px] text-t-muted hover:border-t-faint hover:text-t-text"
            >
              {f * 100}%
            </button>
          ))}
        </div>
        <dl className="mt-3 space-y-1 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-t-faint">Market price</dt>
            <dd className="text-t-text tnum">{formatPrice(price, info.decimals)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-t-faint">Est. {side === 'buy' ? 'cost' : 'proceeds'}</dt>
            <dd className="text-t-text tnum">{money(cost)}</dd>
          </div>
        </dl>
        <button
          disabled={qty <= 0}
          onClick={() => onOrder(side, qty)}
          className={`mt-3 w-full rounded-lg py-2.5 text-[13px] font-semibold text-white transition disabled:opacity-40 ${
            side === 'buy' ? 'bg-t-up hover:brightness-110' : 'bg-t-down hover:brightness-110'
          }`}
        >
          {side === 'buy' ? 'Buy' : 'Sell'} {qty || ''} {ticker} at market
        </button>
      </div>

      <div className="mt-5 border-t border-t-border px-4 pt-3">
        <h3 className="text-[13px] font-semibold text-t-text">Positions</h3>
        {positions.length === 0 && <p className="py-4 text-[12px] text-t-faint">No open positions. Place an order to get started.</p>}
        <div className="mt-2 space-y-1.5">
          {positions.map((p) => {
            const px = priceOf(p.ticker);
            const pnl = unrealized(p, px);
            const pnlPct = ((px - p.avg) / p.avg) * 100 * Math.sign(p.qty);
            const pi = symbolInfo(p.ticker);
            return (
              <div key={p.ticker} className="group flex items-center gap-2.5 rounded-lg border border-t-border px-3 py-2 hover:bg-t-hover/50">
                <button onClick={() => onSelect(p.ticker)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-t-text">
                      {p.ticker}
                      <span className={`rounded px-1 text-[10px] font-semibold ${p.qty > 0 ? 'bg-t-up/15 text-t-up' : 'bg-t-down/15 text-t-down'}`}>{p.qty > 0 ? 'LONG' : 'SHORT'}</span>
                    </div>
                    <div className="text-[11px] text-t-faint tnum">
                      {Math.abs(p.qty)} @ {formatPrice(p.avg, pi.decimals)}
                    </div>
                  </div>
                </button>
                <div className="text-right">
                  <div className={`text-[13px] font-medium tnum ${pnl >= 0 ? 'text-t-up' : 'text-t-down'}`}>{money(pnl, true)}</div>
                  <div className={`text-[11px] tnum ${pnl >= 0 ? 'text-t-up' : 'text-t-down'}`}>{pct(pnlPct)}</div>
                </div>
                <button onClick={() => onClose(p.ticker)} title="Close position" className="rounded p-1 text-t-faint hover:bg-t-hover hover:text-t-text">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-t-border px-4 pb-4 pt-3">
        <h3 className="text-[13px] font-semibold text-t-text">Recent fills</h3>
        {account.fills.length === 0 && <p className="py-3 text-[12px] text-t-faint">No trades yet.</p>}
        <div className="mt-2 space-y-1">
          {account.fills.slice(0, 8).map((f) => (
            <div key={f.id} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className={`font-semibold uppercase ${f.side === 'buy' ? 'text-t-up' : 'text-t-down'}`}>{f.side}</span>
                <span className="text-t-text">
                  {f.qty} {f.ticker}
                </span>
              </span>
              <span className="text-t-muted tnum">
                {formatPrice(f.price, symbolInfo(f.ticker).decimals)}
                {f.realized !== 0 && <span className={`ml-2 ${f.realized >= 0 ? 'text-t-up' : 'text-t-down'}`}>{money(f.realized, true)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Alerts
export function AlertsPanel({
  ticker,
  alerts,
  onCreate,
  onDelete,
  onClearHistory,
}: {
  ticker: string;
  alerts: PriceAlert[];
  onCreate: (price: number) => void;
  onDelete: (id: string) => void;
  onClearHistory: () => void;
}) {
  const info = symbolInfo(ticker);
  const price = feed.quote(ticker).price;
  const [val, setVal] = useState('');
  const [lastTicker, setLastTicker] = useState('');
  if (lastTicker !== ticker) {
    setLastTicker(ticker);
    setVal(price.toFixed(info.decimals));
  }
  const n = Number(val);
  const active = alerts.filter((a) => !a.triggered);
  const history = alerts.filter((a) => a.triggered);
  const dist = n > 0 ? ((n - price) / price) * 100 : 0;

  return (
    <div className="t-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
      <h3 className="text-[13px] font-semibold text-t-text">New alert · {ticker}</h3>
      <p className="mt-0.5 text-[12px] text-t-faint">Get notified when the price crosses a level.</p>
      <div className="mt-3 flex gap-2">
        <input
          inputMode="decimal"
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ''))}
          className="h-9 min-w-0 flex-1 rounded-lg border border-t-border bg-t-bg px-3 text-[13px] text-t-text tnum outline-none focus:border-t-accent"
        />
        <button
          disabled={!(n > 0)}
          onClick={() => onCreate(n)}
          className="flex items-center gap-1.5 rounded-lg bg-t-accent px-3 text-[13px] font-semibold text-black hover:brightness-110 disabled:opacity-40"
        >
          <Bell size={14} /> Create
        </button>
      </div>
      {n > 0 && (
        <p className="mt-1.5 text-[11px] text-t-faint tnum">
          {dist >= 0 ? 'Above' : 'Below'} current price by {Math.abs(dist).toFixed(2)}%
        </p>
      )}
      <div className="mt-2 flex gap-1">
        {[-5, -2, -1, 1, 2, 5].map((p) => (
          <button
            key={p}
            onClick={() => setVal((price * (1 + p / 100)).toFixed(info.decimals))}
            className="flex-1 rounded-md border border-t-border py-1 text-[11px] text-t-muted hover:border-t-faint hover:text-t-text"
          >
            {p > 0 ? '+' : ''}
            {p}%
          </button>
        ))}
      </div>

      <h3 className="mt-6 text-[13px] font-semibold text-t-text">Active ({active.length})</h3>
      {active.length === 0 && <p className="py-3 text-[12px] text-t-faint">No active alerts.</p>}
      <div className="mt-2 space-y-1.5">
        {active.map((a) => {
          const ai = symbolInfo(a.ticker);
          return (
            <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-t-border px-3 py-2">
              <Bell size={14} className="text-t-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-t-text">{a.ticker}</div>
                <div className="text-[11px] text-t-faint tnum">
                  Crossing {a.dir === 'above' ? '↑' : '↓'} {formatPrice(a.price, ai.decimals)}
                </div>
              </div>
              <button onClick={() => onDelete(a.id)} title="Delete alert" className="rounded p-1 text-t-faint hover:bg-t-hover hover:text-t-down">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-t-text">Triggered</h3>
            <button onClick={onClearHistory} className="text-[11px] text-t-faint hover:text-t-text">
              Clear
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {history.slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[12px]">
                <BellRing size={13} className="text-t-faint" />
                <span className="text-t-text">{a.ticker}</span>
                <span className="text-t-muted tnum">{formatPrice(a.price, symbolInfo(a.ticker).decimals)}</span>
                <span className="ml-auto text-t-faint">{new Date(a.triggered!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
