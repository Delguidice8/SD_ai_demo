import { ArrowDownRight, ArrowUpRight, Lock } from 'lucide-react';
import { SAMPLE_DATA, signals, type Signal } from '../config';

function pnl(s: Signal) {
  if (s.exit === null) return null;
  const raw = (s.exit - s.entry) / s.entry;
  return (s.side === 'LONG' ? raw : -raw) * 100;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });

export default function SignalFeed() {
  const closed = signals.map(pnl).filter((p): p is number => p !== null);
  const wins = closed.filter((p) => p > 0).length;

  return (
    <section id="signals" className="container-x py-24 sm:py-32">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow mb-4">Signal log</p>
          <h2 className="h-section">Every call, posted in public. Wins and losses.</h2>
        </div>
        {SAMPLE_DATA && (
          <p className="sample-badge self-start md:self-auto">Sample data. Replace with your real history</p>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { k: 'Signals shown', v: String(signals.length) },
          { k: 'Closed in profit', v: `${wins} / ${closed.length}` },
          { k: 'Currently open', v: String(signals.length - closed.length) },
        ].map((s) => (
          <div key={s.k} className="panel px-6 py-5">
            <p className="text-sm text-white/45">{s.k}</p>
            <p className="mt-1 font-mono text-2xl">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="panel mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/[0.06] font-mono text-xs uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-6 py-4 font-normal">Date</th>
              <th className="px-6 py-4 font-normal">Pair</th>
              <th className="px-6 py-4 font-normal">Side</th>
              <th className="px-6 py-4 font-normal">Entry</th>
              <th className="px-6 py-4 font-normal">Exit</th>
              <th className="px-6 py-4 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {signals.map((s, i) => {
              const p = pnl(s);
              const long = s.side === 'LONG';
              return (
                <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-6 py-4 text-white/50">{s.date}</td>
                  <td className="px-6 py-4">
                    <span className="text-white">{s.pair}</span>
                    <span className="ml-2 text-xs text-white/35">{s.timeframe} · {s.indicator}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 ${long ? 'text-bull' : 'text-bear'}`}>
                      {long ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{s.side}
                    </span>
                  </td>
                  <td className="px-6 py-4">{fmt(s.entry)}</td>
                  <td className="px-6 py-4">
                    {s.exit === null ? (
                      <span className="inline-flex items-center gap-1.5 text-white/40"><Lock className="h-3.5 w-3.5" /> Members only</span>
                    ) : fmt(s.exit)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {p === null ? (
                      <span className="rounded-full bg-lime-signal/10 px-2.5 py-1 text-xs text-lime-signal">OPEN</span>
                    ) : (
                      <span className={p >= 0 ? 'text-bull' : 'text-bear'}>{p >= 0 ? '+' : ''}{p.toFixed(2)}%</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-white/35">
        Results are price moves from entry to exit, before fees and slippage. Past performance does not guarantee future results.
      </p>
    </section>
  );
}
