import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, SymbolBadge } from './ui';
import { SYMBOLS, feed, formatPrice } from '../market';
import type { AssetClass } from '../market';
import { INDICATORS } from '../indicators';
import type { IndicatorConfig, IndicatorType } from '../indicators';

const CLASSES: ('All' | AssetClass)[] = ['All', 'Stocks', 'Crypto', 'Forex', 'Indices', 'Futures'];

export function SymbolSearch({ initial = '', title = 'Symbol Search', onPick, onClose }: { initial?: string; title?: string; onPick: (t: string) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [cls, setCls] = useState<'All' | AssetClass>('All');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const s = q.trim().toUpperCase();
    return SYMBOLS.filter((x) => (cls === 'All' || x.type === cls) && (!s || x.ticker.includes(s) || x.name.toUpperCase().includes(s))).sort((a, b) => {
      const as = a.ticker.startsWith(s) ? 0 : 1;
      const bs = b.ticker.startsWith(s) ? 0 : 1;
      return as - bs;
    });
  }, [q, cls]);

  useEffect(() => setActive(0), [q, cls]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <Modal title={title} onClose={onClose} width="max-w-xl">
      <div className="border-b border-t-border px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-t-border bg-t-bg px-3 focus-within:border-t-accent">
          <Search size={16} className="text-t-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && results[active]) {
                onPick(results[active].ticker);
              }
            }}
            placeholder="Search ticker or company"
            className="h-10 w-full bg-transparent text-[14px] text-t-text outline-none placeholder:text-t-faint"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => setCls(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                cls === c ? 'bg-t-text text-t-bg' : 'bg-t-hover text-t-muted hover:text-t-text'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} className="t-scroll flex-1 overflow-y-auto py-1">
        {results.length === 0 && <p className="px-5 py-10 text-center text-[13px] text-t-muted">No symbols match “{q}”.</p>}
        {results.map((s, i) => {
          const qt = feed.quote(s.ticker);
          const ch = ((qt.price - qt.prevClose) / qt.prevClose) * 100;
          return (
            <button
              key={s.ticker}
              data-i={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(s.ticker)}
              className={`flex w-full items-center gap-3 px-5 py-2.5 text-left ${i === active ? 'bg-t-hover' : ''}`}
            >
              <SymbolBadge ticker={s.ticker} size={26} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-t-text">{s.ticker}</div>
                <div className="truncate text-[12px] text-t-muted">{s.name}</div>
              </div>
              <div className="text-right tnum">
                <div className="text-[13px] text-t-text">{formatPrice(qt.price, s.decimals)}</div>
                <div className={`text-[12px] ${ch >= 0 ? 'text-t-up' : 'text-t-down'}`}>
                  {ch >= 0 ? '+' : ''}
                  {ch.toFixed(2)}%
                </div>
              </div>
              <span className="hidden w-20 text-right text-[11px] font-medium uppercase tracking-wide text-t-faint sm:block">{s.exchange}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function IndicatorPicker({ onPick, onClose }: { onPick: (t: IndicatorType) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = Object.values(INDICATORS).filter((d) => (d.name + d.type + d.description).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Indicators" onClose={onClose}>
      <div className="border-b border-t-border px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-t-border bg-t-bg px-3 focus-within:border-t-accent">
          <Search size={16} className="text-t-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search indicators" className="h-10 w-full bg-transparent text-[14px] text-t-text outline-none placeholder:text-t-faint" />
        </div>
      </div>
      <div className="t-scroll flex-1 overflow-y-auto py-1">
        {list.map((d) => (
          <button key={d.type} onClick={() => onPick(d.type)} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-t-hover">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: d.colors[0] + '22', color: d.colors[0] }}>
              {d.type.slice(0, 4)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-t-text">{d.name}</div>
              <div className="truncate text-[12px] text-t-muted">{d.description}</div>
            </div>
            <span className="rounded-full border border-t-border px-2 py-0.5 text-[11px] text-t-faint">{d.pane === 'overlay' ? 'On chart' : 'Separate pane'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function IndicatorSettings({ cfg, onSave, onClose }: { cfg: IndicatorConfig; onSave: (c: IndicatorConfig) => void; onClose: () => void }) {
  const def = INDICATORS[cfg.type];
  const [params, setParams] = useState({ ...cfg.params });
  const [colors, setColors] = useState([...cfg.colors]);
  const sample = def.compute([], params, colors).series;

  return (
    <Modal title={`${def.name} settings`} onClose={onClose} width="max-w-md">
      <div className="space-y-5 px-5 py-4">
        {def.params.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-t-faint">Inputs</h3>
            <div className="space-y-2">
              {def.params.map((p) => (
                <label key={p.key} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-t-muted">{p.label}</span>
                  <input
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={p.step ?? 1}
                    value={params[p.key]}
                    onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })}
                    className="h-9 w-28 rounded-md border border-t-border bg-t-bg px-3 text-right text-[13px] text-t-text tnum outline-none focus:border-t-accent"
                  />
                </label>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-t-faint">Style</h3>
          <div className="space-y-2">
            {colors.map((c, i) => (
              <label key={i} className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-t-muted">{sample[i]?.name ?? (cfg.type === 'MACD' ? (i === 2 ? 'Histogram up' : 'Histogram down') : `Color ${i + 1}`)}</span>
                <input
                  type="color"
                  value={c}
                  onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value : x)))}
                  className="h-8 w-12 cursor-pointer rounded border border-t-border bg-transparent"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
      <div className="flex justify-end gap-2 border-t border-t-border px-5 py-3">
        <button onClick={() => { setParams(Object.fromEntries(def.params.map((p) => [p.key, p.default]))); setColors([...def.colors]); }} className="mr-auto rounded-md px-3 py-2 text-[13px] text-t-muted hover:bg-t-hover hover:text-t-text">
          Defaults
        </button>
        <button onClick={onClose} className="rounded-md px-4 py-2 text-[13px] text-t-muted hover:bg-t-hover hover:text-t-text">
          Cancel
        </button>
        <button
          onClick={() => {
            const clean = { ...params };
            for (const p of def.params) clean[p.key] = Math.min(p.max, Math.max(p.min, Number.isFinite(clean[p.key]) ? clean[p.key] : p.default));
            onSave({ ...cfg, params: clean, colors });
          }}
          className="rounded-md bg-t-accent px-4 py-2 text-[13px] font-semibold text-black hover:brightness-110"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
