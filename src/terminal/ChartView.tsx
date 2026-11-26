import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Settings2, Trash2, X } from 'lucide-react';
import { ChartEngine } from './chart/engine';
import type { ChartType, Drawing, PaneLayout, PriceLine, Tool } from './chart/engine';
import { INDICATORS, indicatorLabel } from './indicators';
import type { IndicatorConfig } from './indicators';
import { applyTick, feed, formatPrice, formatVolume, heikinAshi, symbolInfo, timeframe } from './market';
import type { QuoteSource } from './market';
import { loadHistory } from './data/providers';
import type { Bar } from './market';
import { CHART_THEMES } from './theme';
import type { ThemeMode } from './theme';

export interface ChartHandle {
  fitFrom: (t: number) => void;
  resetView: () => void;
  zoom: (f: number) => void;
  snapshot: () => string;
  scrollToLatest: () => void;
}

interface Props {
  symbol: string;
  tf: string;
  chartType: ChartType;
  indicators: IndicatorConfig[];
  drawings: Drawing[];
  onDrawingsChange: (d: Drawing[]) => void;
  tool: Tool;
  onToolDone: () => void;
  magnet: boolean;
  hideDrawings: boolean;
  lockDrawings: boolean;
  logScale: boolean;
  autoScale: boolean;
  onAutoScaleChange: (v: boolean) => void;
  showVolume: boolean;
  theme: ThemeMode;
  priceLines: PriceLine[];
  onEditIndicator: (id: string) => void;
  onRemoveIndicator: (id: string) => void;
  onToggleIndicator: (id: string) => void;
  onOpenSymbol: () => void;
}

const DRAW_COLORS = ['#5ab0ff', '#f0b44c', '#26c28b', '#f0506e', '#b48cff', '#3fd0c9', '#e6e9ef'];

export const ChartView = forwardRef<ChartHandle, Props>(function ChartView(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const rawRef = useRef<Bar[]>([]);
  const [version, setVersion] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [panes, setPanes] = useState<PaneLayout[]>([]);
  const [selected, setSelected] = useState<{ id: string; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ source: QuoteSource; note?: string }>({ source: 'sim' });
  const loadedKey = useRef('');
  const tickState = useRef({ time: 0, cum: 0 });

  const info = symbolInfo(props.symbol);
  const tf = timeframe(props.tf);

  // keep latest callbacks without re-creating the engine
  const cbRef = useRef(props);
  cbRef.current = props;

  useEffect(() => {
    const engine = new ChartEngine(
      hostRef.current!,
      {
        chartType: props.chartType,
        decimals: info.decimals,
        logScale: props.logScale,
        autoScale: true,
        showVolume: props.showVolume,
        theme: CHART_THEMES[props.theme],
        watermark: props.symbol,
        indicators: [],
        priceLines: [],
        drawings: props.drawings,
        tool: props.tool,
        magnet: props.magnet,
        hideDrawings: props.hideDrawings,
        lockDrawings: props.lockDrawings,
      },
      {
        onCrosshair: (i) => setHover(i),
        onDrawingsChange: (d) => cbRef.current.onDrawingsChange(d),
        onToolDone: () => cbRef.current.onToolDone(),
        onSelect: (id, a) => setSelected(id && a ? { id, ...a } : null),
        onLayout: (p) => setPanes(p),
        onAutoScaleChange: (v) => cbRef.current.onAutoScaleChange(v),
      },
    );
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // engine is created once; options flow in through setOptions below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    fitFrom: (t) => engineRef.current?.fitFrom(t),
    resetView: () => engineRef.current?.resetView(),
    zoom: (f) => engineRef.current?.zoom(f),
    snapshot: () => engineRef.current?.snapshot() ?? '',
    scrollToLatest: () => engineRef.current?.scrollToLatest(),
  }));

  // load history when symbol / timeframe changes
  useEffect(() => {
    const key = props.symbol + '|' + props.tf;
    const ctrl = new AbortController();
    setLoading(true);
    setSelected(null);
    loadHistory(props.symbol, tf, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        rawRef.current = res.bars;
        loadedKey.current = key;
        const q = feed.quote(props.symbol);
        tickState.current = { time: res.source === 'sim' ? 0 : res.bars[res.bars.length - 1].t, cum: q.cumVolume };
        setHistory({ source: res.source, note: res.note });
        setLoading(false);
        setVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [props.symbol, props.tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // live ticks: apply only genuinely new prices, using the trade's own time
  useEffect(() => {
    const key = props.symbol + '|' + props.tf;
    return feed.subscribe(() => {
      if (loadedKey.current !== key || !rawRef.current.length) return;
      const q = feed.quote(props.symbol);
      const st = tickState.current;
      if (q.time <= st.time) return;
      const inc = Math.max(0, q.cumVolume - st.cum);
      st.time = q.time;
      st.cum = q.cumVolume;
      applyTick(rawRef.current, tf, q.price, q.time, inc);
      setVersion((v) => v + 1);
    });
  }, [props.symbol, props.tf]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayBars = useMemo(
    () => (props.chartType === 'heikin' ? heikinAshi(rawRef.current) : rawRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, props.chartType],
  );

  const computed = useMemo(
    () =>
      props.indicators.map((cfg) => ({
        cfg,
        out: INDICATORS[cfg.type].compute(rawRef.current, cfg.params, cfg.colors),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, props.indicators],
  );

  // push data — reset the view whenever the symbol or timeframe changes
  const lastKey = useRef('');
  useEffect(() => {
    const key = loadedKey.current;
    if (!key) return;
    const reset = key !== lastKey.current;
    lastKey.current = key;
    engineRef.current?.setOptions({ indicators: computed });
    engineRef.current?.setData(displayBars, rawRef.current, tf.ms, reset);
  }, [displayBars, computed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    engineRef.current?.setOptions({
      chartType: props.chartType,
      decimals: info.decimals,
      logScale: props.logScale,
      autoScale: props.autoScale,
      showVolume: props.showVolume,
      theme: CHART_THEMES[props.theme],
      watermark: props.symbol,
      priceLines: props.priceLines,
      drawings: props.drawings,
      tool: props.tool,
      magnet: props.magnet,
      hideDrawings: props.hideDrawings,
      lockDrawings: props.lockDrawings,
    });
  }, [
    props.chartType,
    info.decimals,
    props.logScale,
    props.autoScale,
    props.showVolume,
    props.theme,
    props.symbol,
    props.priceLines,
    props.drawings,
    props.tool,
    props.magnet,
    props.hideDrawings,
    props.lockDrawings,
  ]);

  // countdown on the price axis needs a repaint even without ticks
  useEffect(() => {
    const id = window.setInterval(() => engineRef.current?.requestRender(), 1000);
    return () => window.clearInterval(id);
  }, []);

  const raw = rawRef.current;
  const idx = hover !== null && hover < raw.length ? hover : raw.length - 1;
  const bar = raw[idx];
  const prev = raw[idx - 1];
  const change = bar && prev ? bar.c - prev.c : 0;
  const changePct = bar && prev ? (change / prev.c) * 100 : 0;
  const up = bar ? bar.c >= bar.o : true;
  const valColor = up ? 'text-t-up' : 'text-t-down';
  const fmt = (v: number) => formatPrice(v, info.decimals);

  const fmtVal = (v: number) => {
    if (isNaN(v)) return '∅';
    const a = Math.abs(v);
    if (a >= 1e6) return formatVolume(v);
    return v.toLocaleString('en-US', { maximumFractionDigits: a >= 100 ? 2 : a >= 1 ? 3 : 5 });
  };

  const changeDrawingColor = useCallback((color: string) => {
    if (selected) engineRef.current?.updateDrawing(selected.id, { color });
  }, [selected]);

  const overlays = computed.filter((c) => INDICATORS[c.cfg.type].pane === 'overlay');
  const subs = computed.filter((c) => INDICATORS[c.cfg.type].pane === 'sub');

  const indicatorRow = (c: (typeof computed)[number]) => (
    <div key={c.cfg.id} className="group pointer-events-auto flex items-center gap-2 rounded px-1 -mx-1 hover:bg-t-panel/80 max-w-full">
      <span className={`text-[12px] whitespace-nowrap ${c.cfg.hidden ? 'text-t-faint' : 'text-t-text'}`}>{indicatorLabel(c.cfg)}</span>
      {!c.cfg.hidden && (
        <span className="flex gap-2 text-[12px] tnum truncate">
          {c.out.series.map((s) => (
            <span key={s.name} style={{ color: s.color.split('|')[0] }}>
              {fmtVal(s.values[idx])}
            </span>
          ))}
        </span>
      )}
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button title={c.cfg.hidden ? 'Show' : 'Hide'} onClick={() => props.onToggleIndicator(c.cfg.id)} className="p-0.5 rounded hover:bg-t-hover text-t-muted hover:text-t-text">
          {c.cfg.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button title="Settings" onClick={() => props.onEditIndicator(c.cfg.id)} className="p-0.5 rounded hover:bg-t-hover text-t-muted hover:text-t-text">
          <Settings2 size={13} />
        </button>
        <button title="Remove" onClick={() => props.onRemoveIndicator(c.cfg.id)} className="p-0.5 rounded hover:bg-t-hover text-t-muted hover:text-t-down">
          <X size={13} />
        </button>
      </span>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" />

      {/* main legend */}
      {bar && (
        <div className="pointer-events-none absolute left-3 top-2 right-24 flex flex-col gap-0.5 select-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <button onClick={props.onOpenSymbol} className="pointer-events-auto flex items-center gap-1.5 text-[13px] font-semibold text-t-text hover:text-t-accent transition-colors">
              <span>{info.ticker}</span>
              <span className="text-t-faint font-normal">·</span>
              <span className="font-medium text-t-muted">{tf.label}</span>
              <span className="text-t-faint font-normal">·</span>
              <span className="font-medium text-t-muted hidden sm:inline">{info.exchange}</span>
            </button>
            <SourcePill quote={feed.quote(props.symbol).source} history={history.source} note={history.note} />
            <div className="flex flex-wrap gap-x-2.5 text-[12px] tnum">
              <span className="text-t-muted">O<span className={`ml-1 ${valColor}`}>{fmt(bar.o)}</span></span>
              <span className="text-t-muted">H<span className={`ml-1 ${valColor}`}>{fmt(bar.h)}</span></span>
              <span className="text-t-muted">L<span className={`ml-1 ${valColor}`}>{fmt(bar.l)}</span></span>
              <span className="text-t-muted">C<span className={`ml-1 ${valColor}`}>{fmt(bar.c)}</span></span>
              <span className={valColor}>
                {change >= 0 ? '+' : ''}
                {fmt(change)} ({changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%)
              </span>
              {props.showVolume && <span className="text-t-muted">Vol<span className="ml-1 text-t-text">{formatVolume(bar.v)}</span></span>}
            </div>
          </div>
          {overlays.map((c) => indicatorRow(c))}
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-full border border-t-border bg-t-elev/95 px-4 py-2 text-[12px] text-t-muted shadow-lg">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-faint border-t-transparent" style={{ borderTopColor: 'transparent' }} />
            Loading {props.symbol} {tf.label}…
          </div>
        </div>
      )}

      {/* sub-pane legends */}
      {subs.map((c) => {
        const pane = panes.find((p) => p.id === c.cfg.id);
        if (!pane) return null;
        return (
          <div key={c.cfg.id} className="pointer-events-none absolute left-3 select-none" style={{ top: pane.top + 4 }}>
            {indicatorRow(c)}
          </div>
        );
      })}

      {/* selected drawing toolbar */}
      {selected && !props.lockDrawings && (
        <div
          className="pop-in absolute z-10 flex items-center gap-1 rounded-lg border border-t-border bg-t-elev p-1 shadow-xl shadow-black/30"
          style={{ left: selected.x, top: selected.y }}
        >
          {DRAW_COLORS.map((c) => (
            <button key={c} onClick={() => changeDrawingColor(c)} className="h-5 w-5 rounded-full border border-white/10 transition-transform hover:scale-110" style={{ background: c }} title="Color" />
          ))}
          <div className="mx-1 h-5 w-px bg-t-border" />
          <button onClick={() => engineRef.current?.deleteSelected()} className="rounded p-1 text-t-muted hover:bg-t-hover hover:text-t-down" title="Delete (Del)">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
});

const SOURCE_LABEL: Record<QuoteSource, string> = {
  coinbase: 'Coinbase',
  finnhub: 'Finnhub',
  twelvedata: 'Twelve Data',
  sim: 'Simulated',
};

function SourcePill({ quote, history, note }: { quote: QuoteSource; history: QuoteSource; note?: string }) {
  const live = quote === 'coinbase' || quote === 'finnhub';
  const real = quote !== 'sim';
  const label = !real ? 'Simulated data' : `${live ? 'Real-time' : 'Delayed'} · ${SOURCE_LABEL[quote]}`;
  const tone = live ? 'text-t-up bg-t-up/10' : real ? 'text-t-accent bg-t-accent/10' : 'text-t-faint bg-t-hover';
  const title = [
    real ? `Price from ${SOURCE_LABEL[quote]}${live ? ' (streaming)' : ' (polled about once a minute)'}` : 'No real data source for this symbol. Add API keys under Data sources.',
    history === 'sim' && real ? 'Candle history is simulated. ' + (note ?? '') : history !== 'sim' ? `History from ${SOURCE_LABEL[history]}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <span title={title} className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-t-up' : real ? 'bg-t-accent' : 'bg-t-faint'}`} />
      {label}
      {real && history === 'sim' && <span className="text-t-faint">· sim history</span>}
    </span>
  );
}
