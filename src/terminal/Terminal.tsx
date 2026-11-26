import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AreaChart,
  BarChart3,
  Bell,
  Camera,
  CandlestickChart,
  ChevronDown,
  Eye,
  EyeOff,
  GitCommitHorizontal,
  LineChart,
  Lock,
  Magnet,
  Maximize2,
  Minus,
  Moon,
  MousePointer2,
  MoveUpRight,
  PanelRight,
  Ruler,
  Search,
  SeparatorVertical,
  Sigma,
  Spline,
  Square,
  Sun,
  Telescope,
  Trash2,
  Unlock,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
  List,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChartView } from './ChartView';
import type { ChartHandle } from './ChartView';
import type { ChartType, Drawing, PriceLine, Tool } from './chart/engine';
import { createIndicator } from './indicators';
import type { IndicatorConfig, IndicatorType } from './indicators';
import { RENAMED, TIMEFRAMES, feed, formatPrice, isKnownSymbol, symbolInfo } from './market';
import { providerStatus, setActiveSymbol, startProviders, stopProviders } from './data/providers';
import { AlertsPanel, SymbolDetails, TradePanel, Watchlist } from './components/Panels';
import { DataSources, IndicatorPicker, IndicatorSettings, SymbolSearch } from './components/Modals';
import { IconButton, Modal } from './components/ui';
import { load, save } from './storage';
import type { ThemeMode } from './theme';
import { executeOrder, newAccount, uid, unrealized } from './trading';
import type { Account, PriceAlert } from './trading';

const CHART_TYPES: { id: ChartType; label: string; icon: LucideIcon }[] = [
  { id: 'candles', label: 'Candles', icon: CandlestickChart },
  { id: 'hollow', label: 'Hollow candles', icon: CandlestickChart },
  { id: 'heikin', label: 'Heikin Ashi', icon: CandlestickChart },
  { id: 'bars', label: 'Bars', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'area', label: 'Area', icon: AreaChart },
];

const TOOLS: { id: Tool; label: string; icon: LucideIcon; key?: string }[] = [
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'trend', label: 'Trend line', icon: Spline },
  { id: 'ray', label: 'Ray', icon: MoveUpRight },
  { id: 'hline', label: 'Horizontal line', icon: Minus },
  { id: 'vline', label: 'Vertical line', icon: SeparatorVertical },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'fib', label: 'Fib retracement', icon: Layers },
  { id: 'measure', label: 'Measure', icon: Ruler },
];

const DAY = 86_400_000;
const RANGES: { label: string; tf: string; from: () => number }[] = [
  { label: '1D', tf: '5', from: () => Date.now() - DAY },
  { label: '5D', tf: '15', from: () => Date.now() - 5 * DAY },
  { label: '1M', tf: '60', from: () => Date.now() - 30 * DAY },
  { label: '3M', tf: '240', from: () => Date.now() - 91 * DAY },
  { label: '6M', tf: 'D', from: () => Date.now() - 182 * DAY },
  { label: 'YTD', tf: 'D', from: () => new Date(new Date().getFullYear(), 0, 1).getTime() },
  { label: '1Y', tf: 'D', from: () => Date.now() - 365 * DAY },
  { label: '5Y', tf: 'W', from: () => Date.now() - 5 * 365 * DAY },
  { label: 'All', tf: 'W', from: () => 0 },
];

const DEFAULT_INDICATORS = () => [createIndicator('EMA', { length: 21 }, ['#f0b44c']), createIndicator('SMA', { length: 50 }, ['#5ab0ff']), createIndicator('RSI')];

const migrate = (t: string) => RENAMED[t] ?? t;
const migrateList = (l: string[]) => [...new Set(l.map(migrate).filter(isKnownSymbol))];
const migrateKeys = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [migrate(k), v]));

interface Toast {
  id: string;
  title: string;
  body: string;
  tone: 'up' | 'down' | 'accent';
}

type RightTab = 'watch' | 'trade' | 'alerts';

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.36);
  } catch {
    /* audio unavailable */
  }
}

function useIsWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

export default function Terminal() {
  useSyncExternalStore(feed.subscribe, feed.getVersion);

  const [symbol, setSymbol] = useState(() => {
    const t = migrate(load('symbol', 'BTCUSD'));
    return isKnownSymbol(t) ? t : 'BTCUSD';
  });
  const [tf, setTf] = useState(() => load('tf', '60'));
  const [chartType, setChartType] = useState<ChartType>(() => load('chartType', 'candles'));
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => load('indicators', DEFAULT_INDICATORS()));
  const [drawings, setDrawings] = useState<Record<string, Drawing[]>>(() => migrateKeys(load('drawings', {})));
  const [watchlist, setWatchlist] = useState<string[]>(() => migrateList(load('watchlist', ['BTCUSD', 'ETHUSD', 'SOLUSD', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY', 'EURUSD', 'XAUUSD'])));
  const [theme, setTheme] = useState<ThemeMode>(() => load('theme', 'dark'));
  const [showVolume, setShowVolume] = useState(() => load('showVolume', true));
  const [logScale, setLogScale] = useState(() => load('logScale', false));
  const [account, setAccount] = useState<Account>(() => {
    const a = load('account', newAccount());
    return { ...a, positions: migrateKeys(a.positions) };
  });
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => load('alerts', []));

  const [autoScale, setAutoScale] = useState(true);
  const [tool, setTool] = useState<Tool>('cursor');
  const [magnet, setMagnet] = useState(false);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [lockDrawings, setLockDrawings] = useState(false);
  const isWide = useIsWide();
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1024);
  const [rightTab, setRightTab] = useState<RightTab>('watch');
  const [search, setSearch] = useState<{ mode: 'symbol' | 'add'; initial: string } | null>(null);
  const [pickIndicator, setPickIndicator] = useState(false);
  const [editIndicator, setEditIndicator] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [range, setRange] = useState<string | null>(null);
  const [confirmBox, setConfirmBox] = useState<{ title: string; body: string; action: string; run: () => void } | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle>(null);

  // persistence
  useEffect(() => save('symbol', symbol), [symbol]);
  useEffect(() => save('tf', tf), [tf]);
  useEffect(() => save('chartType', chartType), [chartType]);
  useEffect(() => save('indicators', indicators), [indicators]);
  useEffect(() => save('drawings', drawings), [drawings]);
  useEffect(() => save('watchlist', watchlist), [watchlist]);
  useEffect(() => save('theme', theme), [theme]);
  useEffect(() => save('showVolume', showVolume), [showVolume]);
  useEffect(() => save('logScale', logScale), [logScale]);
  useEffect(() => save('account', account), [account]);
  useEffect(() => save('alerts', alerts), [alerts]);

  useEffect(() => {
    feed.start();
    startProviders();
    return () => {
      feed.stop();
      stopProviders();
    };
  }, []);
  useEffect(() => setActiveSymbol(symbol), [symbol]);
  useSyncExternalStore(providerStatus.subscribe, providerStatus.version);
  const pStatus = providerStatus.get();
  const anyKeyless = pStatus.finnhub.state === 'off' && pStatus.twelvedata.state === 'off';
  const anyError = Object.values(pStatus).some((p) => p.state === 'error');
  const [dataOpen, setDataOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('t-light', theme === 'light');
    document.documentElement.classList.toggle('t-dark', theme === 'dark');
  }, [theme]);

  const info = symbolInfo(symbol);
  const quote = feed.quote(symbol);
  const dayChange = quote.price - quote.prevClose;
  const dayPct = (dayChange / quote.prevClose) * 100;

  useEffect(() => {
    document.title = `${symbol} ${formatPrice(quote.price, info.decimals)} ${dayPct >= 0 ? '▲' : '▼'} ${Math.abs(dayPct).toFixed(2)}% · Vantage`;
  });

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('t');
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
  }, []);

  // alert monitoring
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  useEffect(
    () =>
      feed.subscribe(() => {
        const hits = alertsRef.current.filter((a) => {
          if (a.triggered) return false;
          const p = feed.quote(a.ticker).price;
          return a.dir === 'above' ? p >= a.price : p <= a.price;
        });
        if (!hits.length) return;
        const ids = new Set(hits.map((h) => h.id));
        const now = Date.now();
        setAlerts((as) => as.map((a) => (ids.has(a.id) ? { ...a, triggered: now } : a)));
        beep();
        for (const h of hits)
          pushToast({
            title: `${h.ticker} alert triggered`,
            body: `Price crossed ${h.dir === 'above' ? 'above' : 'below'} ${formatPrice(h.price, symbolInfo(h.ticker).decimals)}`,
            tone: 'accent',
          });
      }),
    [pushToast],
  );

  // type-to-search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (search || pickIndicator || editIndicator || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        setSearch({ mode: 'symbol', initial: e.key.toUpperCase() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search, pickIndicator, editIndicator]);

  // apply a pending range after timeframe switch
  useEffect(() => {
    if (!range) return;
    const r = RANGES.find((x) => x.label === range);
    if (r) requestAnimationFrame(() => chartRef.current?.fitFrom(r.from()));
  }, [range, tf]);

  const symbolDrawings = useMemo(() => drawings[symbol] ?? [], [drawings, symbol]);
  const onDrawingsChange = useCallback((d: Drawing[]) => setDrawings((all) => ({ ...all, [symbol]: d })), [symbol]);
  const onToolDone = useCallback(() => setTool('cursor'), []);

  const position = account.positions[symbol];
  const posPnl = position ? unrealized(position, quote.price) : 0;
  const posKey = position ? `${position.qty}|${position.avg}|${Math.round(posPnl * 100)}` : '';
  const alertKey = alerts.filter((a) => a.ticker === symbol && !a.triggered).map((a) => a.id + a.price).join(',');
  const priceLines = useMemo<PriceLine[]>(() => {
    const lines: PriceLine[] = [];
    if (position) {
      const sign = posPnl >= 0 ? '+' : '−';
      lines.push({
        price: position.avg,
        color: posPnl >= 0 ? '#26c28b' : '#f0506e',
        label: `${position.qty > 0 ? 'LONG' : 'SHORT'} ${Math.abs(position.qty)}  ${sign}$${Math.abs(posPnl).toFixed(2)}`,
      });
    }
    for (const a of alerts) if (a.ticker === symbol && !a.triggered) lines.push({ price: a.price, color: '#f0b44c', label: '⏰ Alert', dashed: true });
    return lines;
  }, [posKey, alertKey, symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSymbol = (t: string) => {
    setSymbol(t);
    if (!isWide) setRightOpen(false);
  };

  const placeOrder = (side: 'buy' | 'sell', qty: number, ticker = symbol) => {
    const price = feed.quote(ticker).price;
    setAccount((a) => executeOrder(a, ticker, side, qty, price));
    pushToast({
      title: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${ticker}`,
      body: `Filled at ${formatPrice(price, symbolInfo(ticker).decimals)} (paper)`,
      tone: side === 'buy' ? 'up' : 'down',
    });
  };

  const closePosition = (t: string) => {
    const p = account.positions[t];
    if (p) placeOrder(p.qty > 0 ? 'sell' : 'buy', Math.abs(p.qty), t);
  };

  const createAlert = (price: number) => {
    const cur = feed.quote(symbol).price;
    setAlerts((as) => [{ id: uid('a'), ticker: symbol, price, dir: price >= cur ? 'above' : 'below', created: Date.now() }, ...as]);
    pushToast({ title: 'Alert created', body: `${symbol} crossing ${formatPrice(price, info.decimals)}`, tone: 'accent' });
  };

  const addIndicator = (type: IndicatorType) => {
    setIndicators((list) => [...list, createIndicator(type)]);
    setPickIndicator(false);
  };

  const snapshot = () => {
    const url = chartRef.current?.snapshot();
    if (url) setShot(url);
  };
  const shotName = `${symbol}-${TIMEFRAMES.find((x) => x.id === tf)?.label}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const CurrentType = CHART_TYPES.find((c) => c.id === chartType) ?? CHART_TYPES[0];
  const editing = indicators.find((i) => i.id === editIndicator);
  const activeAlerts = alerts.filter((a) => !a.triggered).length;

  const rightTabs: { id: RightTab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: 'watch', label: 'Watchlist', icon: List },
    { id: 'trade', label: 'Trade', icon: Wallet, badge: Object.keys(account.positions).length || undefined },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: activeAlerts || undefined },
  ];

  return (
    <div className="flex h-full flex-col bg-t-bg text-t-text">
      {/* ------------------------------------------------ top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-t-border bg-t-panel px-2">
        <a href="./terminal.html" className="mr-1 flex items-center gap-2 rounded-md px-1.5 py-1" title="Vantage">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-t-accent to-[#e0742c] text-black shadow-sm">
            <Telescope size={16} strokeWidth={2.4} />
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight md:inline">Vantage</span>
        </a>

        <button
          onClick={() => setSearch({ mode: 'symbol', initial: '' })}
          className="flex h-9 items-center gap-2 rounded-md px-2 text-[14px] font-semibold hover:bg-t-hover"
          title="Symbol search (start typing)"
        >
          <Search size={15} className="text-t-muted" />
          <span>{symbol}</span>
        </button>

        <div className="mx-1 hidden h-6 w-px bg-t-border sm:block" />

        <select
          aria-label="Timeframe"
          value={tf}
          onChange={(e) => {
            setRange(null);
            setTf(e.target.value);
          }}
          className="h-8 rounded-md bg-t-accent/15 px-1.5 text-[13px] font-semibold text-t-accent outline-none sm:hidden"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="no-scrollbar hidden min-w-0 items-center overflow-x-auto sm:flex">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setRange(null);
                setTf(t.id);
              }}
              className={`h-8 shrink-0 rounded-md px-2 text-[13px] font-medium transition-colors ${
                tf === t.id ? 'bg-t-accent/15 text-t-accent' : 'text-t-muted hover:bg-t-hover hover:text-t-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-t-border" />

        <div className="relative">
          <button onClick={() => setTypeMenu((v) => !v)} className="flex h-9 items-center gap-1 rounded-md px-2 text-t-muted hover:bg-t-hover hover:text-t-text" title="Chart type">
            <CurrentType.icon size={17} />
            <ChevronDown size={13} />
          </button>
          {typeMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setTypeMenu(false)} />
              <div className="pop-in absolute left-0 top-10 z-40 w-48 rounded-lg border border-t-border bg-t-elev p-1 shadow-xl shadow-black/30">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChartType(c.id);
                      setTypeMenu(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${chartType === c.id ? 'bg-t-accent/15 text-t-accent' : 'text-t-text hover:bg-t-hover'}`}
                  >
                    <c.icon size={16} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button onClick={() => setPickIndicator(true)} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-t-muted hover:bg-t-hover hover:text-t-text" title="Indicators">
          <Sigma size={17} />
          <span className="hidden sm:inline">Indicators</span>
        </button>

        <button
          onClick={() => {
            setRightOpen(true);
            setRightTab('alerts');
          }}
          className="hidden h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-t-muted hover:bg-t-hover hover:text-t-text md:flex"
          title="Create alert"
        >
          <BellRing size={16} />
          <span className="hidden xl:inline">Alert</span>
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <div className="mr-2 hidden items-baseline gap-2 tnum lg:flex">
            <span className="text-[14px] font-semibold">{formatPrice(quote.price, info.decimals)}</span>
            <span className={`text-[12px] font-medium ${dayChange >= 0 ? 'text-t-up' : 'text-t-down'}`}>
              {dayChange >= 0 ? '+' : ''}
              {dayPct.toFixed(2)}%
            </span>
          </div>
          <button
            onClick={() => setDataOpen(true)}
            title="Data sources"
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-t-muted hover:bg-t-hover hover:text-t-text"
          >
            <span className="relative">
              <Database size={16} />
              <span
                className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[rgb(var(--t-panel))] ${
                  anyError ? 'bg-t-down' : anyKeyless ? 'bg-t-accent' : 'bg-t-up'
                }`}
              />
            </span>
            <span className="hidden xl:inline">Data</span>
          </button>
          <IconButton title="Take snapshot" onClick={snapshot} className="hidden sm:flex">
            <Camera size={17} />
          </IconButton>
          <IconButton title={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
          <IconButton title="Fullscreen" onClick={toggleFullscreen} className="hidden sm:flex">
            <Maximize2 size={16} />
          </IconButton>
          <IconButton title="Toggle side panel" active={rightOpen} onClick={() => setRightOpen((v) => !v)}>
            <PanelRight size={17} />
          </IconButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ------------------------------------------------ drawing toolbar */}
        <nav className="t-scroll flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-t-border bg-t-panel py-1.5" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <IconButton key={t.id} title={t.label} active={tool === t.id} onClick={() => setTool(tool === t.id && t.id !== 'cursor' ? 'cursor' : t.id)}>
              <t.icon size={17} />
            </IconButton>
          ))}
          <div className="my-1 h-px w-6 bg-t-border" />
          <IconButton title="Magnet mode (snap to OHLC)" active={magnet} onClick={() => setMagnet((v) => !v)}>
            <Magnet size={17} />
          </IconButton>
          <IconButton title={lockDrawings ? 'Unlock drawings' : 'Lock drawings'} active={lockDrawings} onClick={() => setLockDrawings((v) => !v)}>
            {lockDrawings ? <Lock size={17} /> : <Unlock size={17} />}
          </IconButton>
          <IconButton title={hideDrawings ? 'Show drawings' : 'Hide drawings'} active={hideDrawings} onClick={() => setHideDrawings((v) => !v)}>
            {hideDrawings ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <IconButton
            title="Remove all drawings"
            onClick={() => {
              if (symbolDrawings.length)
                setConfirmBox({
                  title: 'Remove all drawings',
                  body: `Remove all ${symbolDrawings.length} drawings on ${symbol}? This can’t be undone.`,
                  action: 'Remove drawings',
                  run: () => onDrawingsChange([]),
                });
            }}
          >
            <Trash2 size={17} />
          </IconButton>
          <div className="my-1 h-px w-6 bg-t-border" />
          <IconButton title="Zoom in" onClick={() => chartRef.current?.zoom(1.25)}>
            <ZoomIn size={17} />
          </IconButton>
          <IconButton title="Zoom out" onClick={() => chartRef.current?.zoom(0.8)}>
            <ZoomOut size={17} />
          </IconButton>
        </nav>

        {/* ------------------------------------------------ chart */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ChartView
              ref={chartRef}
              symbol={symbol}
              tf={tf}
              chartType={chartType}
              indicators={indicators}
              drawings={symbolDrawings}
              onDrawingsChange={onDrawingsChange}
              tool={tool}
              onToolDone={onToolDone}
              magnet={magnet}
              hideDrawings={hideDrawings}
              lockDrawings={lockDrawings}
              logScale={logScale}
              autoScale={autoScale}
              onAutoScaleChange={setAutoScale}
              showVolume={showVolume}
              theme={theme}
              priceLines={priceLines}
              onEditIndicator={setEditIndicator}
              onRemoveIndicator={(id) => setIndicators((l) => l.filter((i) => i.id !== id))}
              onToggleIndicator={(id) => setIndicators((l) => l.map((i) => (i.id === id ? { ...i, hidden: !i.hidden } : i)))}
              onOpenSymbol={() => setSearch({ mode: 'symbol', initial: '' })}
            />
            {tool !== 'cursor' && (
              <div className="pop-in pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-t-border bg-t-elev/95 px-3 py-1.5 text-[12px] text-t-muted shadow-lg">
                {tool === 'hline' || tool === 'vline' ? 'Click to place' : 'Click (or drag) to set two points'} · <span className="text-t-faint">Esc to cancel</span>
              </div>
            )}
          </div>

          {/* ------------------------------------------------ bottom bar */}
          <footer className="flex h-9 shrink-0 items-center gap-1 border-t border-t-border bg-t-panel px-2">
            <div className="no-scrollbar flex min-w-0 items-center overflow-x-auto">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => {
                    setTf(r.tf);
                    setRange(r.label);
                    requestAnimationFrame(() => chartRef.current?.fitFrom(r.from()));
                  }}
                  className={`h-7 shrink-0 rounded px-2 text-[12px] font-medium transition-colors ${
                    range === r.label ? 'text-t-accent' : 'text-t-muted hover:bg-t-hover hover:text-t-text'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5 text-[12px]">
              <Clock />
              <span className="mx-1.5 hidden h-4 w-px bg-t-border sm:block" />
              <button onClick={() => setShowVolume((v) => !v)} className={`h-7 rounded px-2 font-medium ${showVolume ? 'text-t-accent' : 'text-t-muted hover:text-t-text'}`} title="Toggle volume">
                vol
              </button>
              <button onClick={() => setLogScale((v) => !v)} className={`h-7 rounded px-2 font-medium ${logScale ? 'text-t-accent' : 'text-t-muted hover:text-t-text'}`} title="Logarithmic scale">
                log
              </button>
              <button
                onClick={() => setAutoScale((v) => !v)}
                className={`h-7 rounded px-2 font-medium ${autoScale ? 'text-t-accent' : 'text-t-muted hover:text-t-text'}`}
                title="Auto-fit price scale (or double-click the price axis)"
              >
                auto
              </button>
            </div>
          </footer>
        </main>

        {/* ------------------------------------------------ right panel */}
        {rightOpen && !isWide && <div className="absolute inset-0 z-20 bg-black/40" onClick={() => setRightOpen(false)} />}
        {rightOpen && (
          <aside
            className={`flex w-[320px] max-w-[88vw] shrink-0 flex-col border-l border-t-border bg-t-panel ${
              isWide ? '' : 'pop-in absolute inset-y-0 right-0 z-30 shadow-2xl shadow-black/40'
            }`}
          >
            <div className="flex items-center gap-1 border-b border-t-border p-1.5">
              {rightTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setRightTab(t.id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors ${
                    rightTab === t.id ? 'bg-t-hover text-t-text' : 'text-t-muted hover:text-t-text'
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                  {t.badge && <span className="rounded-full bg-t-accent px-1.5 text-[10px] font-bold leading-4 text-black">{t.badge}</span>}
                </button>
              ))}
              {!isWide && (
                <button onClick={() => setRightOpen(false)} className="rounded-md p-1.5 text-t-muted hover:bg-t-hover" aria-label="Close panel">
                  <X size={15} />
                </button>
              )}
            </div>
            {rightTab === 'watch' && (
              <>
                <Watchlist
                  list={watchlist}
                  active={symbol}
                  onSelect={selectSymbol}
                  onRemove={(t) => setWatchlist((w) => w.filter((x) => x !== t))}
                  onAdd={() => setSearch({ mode: 'add', initial: '' })}
                />
                <SymbolDetails ticker={symbol} />
              </>
            )}
            {rightTab === 'trade' && (
              <TradePanel
                ticker={symbol}
                account={account}
                onOrder={(s, q) => placeOrder(s, q)}
                onClose={closePosition}
                onSelect={selectSymbol}
                onReset={() => {
                  setConfirmBox({
                    title: 'Reset paper account',
                    body: 'Reset the account to $100,000 and clear all positions and fills?',
                    action: 'Reset account',
                    run: () => setAccount(newAccount()),
                  });
                }}
              />
            )}
            {rightTab === 'alerts' && (
              <AlertsPanel
                ticker={symbol}
                alerts={alerts}
                onCreate={createAlert}
                onDelete={(id) => setAlerts((as) => as.filter((a) => a.id !== id))}
                onClearHistory={() => setAlerts((as) => as.filter((a) => !a.triggered))}
              />
            )}
          </aside>
        )}
      </div>

      {/* ------------------------------------------------ modals */}
      {search && (
        <SymbolSearch
          initial={search.initial}
          title={search.mode === 'add' ? 'Add to watchlist' : 'Symbol search'}
          onClose={() => setSearch(null)}
          onPick={(t) => {
            if (search.mode === 'add') setWatchlist((w) => (w.includes(t) ? w : [...w, t]));
            else selectSymbol(t);
            setSearch(null);
          }}
        />
      )}
      {dataOpen && <DataSources onClose={() => setDataOpen(false)} />}
      {pickIndicator && <IndicatorPicker onPick={addIndicator} onClose={() => setPickIndicator(false)} />}
      {editing && (
        <IndicatorSettings
          cfg={editing}
          onClose={() => setEditIndicator(null)}
          onSave={(c) => {
            setIndicators((l) => l.map((i) => (i.id === c.id ? c : i)));
            setEditIndicator(null);
          }}
        />
      )}

      {confirmBox && (
        <Modal title={confirmBox.title} onClose={() => setConfirmBox(null)} width="max-w-sm">
          <p className="px-5 py-4 text-[13px] text-t-muted">{confirmBox.body}</p>
          <div className="flex justify-end gap-2 border-t border-t-border px-5 py-3">
            <button onClick={() => setConfirmBox(null)} className="rounded-md px-4 py-2 text-[13px] text-t-muted hover:bg-t-hover hover:text-t-text">
              Cancel
            </button>
            <button
              autoFocus
              onClick={() => {
                confirmBox.run();
                setConfirmBox(null);
              }}
              className="rounded-md bg-t-down px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110"
            >
              {confirmBox.action}
            </button>
          </div>
        </Modal>
      )}
      {shot && (
        <Modal title="Chart snapshot" onClose={() => setShot(null)} width="max-w-4xl">
          <div className="t-scroll overflow-auto p-4">
            <img src={shot} alt={`${symbol} chart snapshot`} className="w-full rounded-lg border border-t-border" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-t-border px-5 py-3">
            <span className="text-[12px] text-t-faint">Right-click or long-press the image to copy or save it.</span>
            <a href={shot} download={shotName} className="shrink-0 rounded-md bg-t-accent px-4 py-2 text-[13px] font-semibold text-black hover:brightness-110">
              Download PNG
            </a>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------ toasts */}
      <div className="pointer-events-none fixed bottom-12 right-3 z-[60] flex w-[300px] max-w-[calc(100vw-24px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto flex gap-3 rounded-xl border border-t-border bg-t-elev p-3 shadow-2xl shadow-black/40">
            <span className={t.tone === 'up' ? 'text-t-up' : t.tone === 'down' ? 'text-t-down' : 'text-t-accent'}>
              {t.tone === 'accent' ? <BellRing size={18} /> : t.tone === 'up' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-t-text">{t.title}</div>
              <div className="text-[12px] text-t-muted">{t.body}</div>
            </div>
            <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="self-start text-t-faint hover:text-t-text" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const off = -now.getTimezoneOffset() / 60;
  return (
    <span className="hidden items-center gap-1.5 px-1 text-t-muted tnum sm:flex" title="Local time">
      <GitCommitHorizontal size={13} className="text-t-up" />
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      <span className="text-t-faint">UTC{off >= 0 ? '+' : ''}{off}</span>
    </span>
  );
}

