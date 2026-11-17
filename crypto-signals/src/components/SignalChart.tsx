import { useMemo } from 'react';

/** Deterministic pseudo-random generator so the sample chart is stable. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

type Marker = { i: number; side: 'buy' | 'sell' };

const W = 640;
const H = 300;
const N = 90;

export default function SignalChart() {
  const { path, area, markers, pts } = useMemo(() => {
    const rnd = seeded(7);
    const values: number[] = [];
    for (let i = 0; i < N; i++) {
      // Cyclical swings with a slight uptrend and some noise.
      values.push(100 + Math.sin(i / 7) * 8 + i * 0.12 + (rnd() - 0.5) * 2.2);
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pts = values.map((val, i) => ({
      x: (i / (N - 1)) * W,
      // Leave room above/below for the BUY/SELL labels.
      y: 40 + (1 - (val - min) / (max - min)) * (H - 80),
    }));

    // Mark swing lows/highs as sample buy/sell signals.
    const markers: Marker[] = [];
    let last = -20;
    for (let i = 5; i < N - 5; i++) {
      const win = values.slice(i - 5, i + 6);
      if (i - last < 10) continue;
      if (values[i] === Math.min(...win)) { markers.push({ i, side: 'buy' }); last = i; }
      else if (values[i] === Math.max(...win)) { markers.push({ i, side: 'sell' }); last = i; }
    }

    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${path} L${W},${H} L0,${H} Z`;
    return { path, area, markers, pts };
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Sample price chart with buy and sell signals">
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#c6f432" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#c6f432" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="white" strokeOpacity="0.05" strokeDasharray="4 6" />
      ))}
      <path d={area} fill="url(#fill)" />
      <path d={path} fill="none" stroke="#c6f432" strokeWidth="2" strokeLinejoin="round" className="chart-line animate-draw" />
      {markers.map((m, k) => {
        const p = pts[m.i];
        const buy = m.side === 'buy';
        const y = buy ? p.y + 22 : p.y - 22;
        return (
          <g key={m.i} className="animate-pop" style={{ animationDelay: `${1.2 + k * 0.15}s`, transformOrigin: `${p.x}px ${y}px` }}>
            <line x1={p.x} x2={p.x} y1={p.y} y2={y} stroke={buy ? '#22d39a' : '#ff5d6c'} strokeOpacity="0.6" />
            <rect x={p.x - 19} y={y - 9} width="38" height="18" rx="9" fill={buy ? '#22d39a' : '#ff5d6c'} />
            <text x={p.x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace" fill="#07090d">
              {buy ? 'BUY' : 'SELL'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
