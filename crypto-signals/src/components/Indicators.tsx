import { Lock } from 'lucide-react';
import { indicators, tierName, tierRank, tiers, type TierId } from '../config';

/** Visual style per plan: lowest plan is neutral, top plan uses the brand accent. */
function tierStyle(id: TierId) {
  const rank = tierRank(id);
  const top = tiers.length - 1;
  if (rank === top) return 'border-lime-signal/40 bg-lime-signal/10 text-lime-signal';
  if (rank === 0) return 'border-white/15 bg-white/[0.06] text-white/75';
  return 'border-bull/40 bg-bull/10 text-bull';
}

export default function Indicators() {
  const sorted = [...indicators].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));

  return (
    <section id="indicators" className="container-x py-24 sm:py-32">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow mb-4">The toolkit</p>
          <h2 className="h-section">Indicators built for one job: clearer decisions.</h2>
          <p className="mt-5 text-lg text-white/55">
            Each tool runs as an invite-only script on TradingView. Start with the basics and unlock more as you level up.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {tiers.map((t, i) => {
            const count = indicators.filter((ind) => tierRank(ind.tier) <= i).length;
            return (
              <li key={t.id} className={`rounded-full border px-3 py-1.5 ${tierStyle(t.id)}`}>
                {t.name} <span className="opacity-70">· {count === indicators.length ? `all ${count}` : count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((ind) => {
          const isBase = tierRank(ind.tier) === 0;
          return (
            <article key={ind.name} className="panel group relative flex flex-col p-7 transition hover:border-lime-signal/40">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-ink-800 font-mono text-sm font-semibold text-lime-signal">
                  {ind.short}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${tierStyle(ind.tier)}`}>
                  {!isBase && <Lock className="h-3 w-3" />}
                  {isBase ? 'Included in all plans' : `${tierName(ind.tier)}${tierRank(ind.tier) < tiers.length - 1 ? '+' : ''}`}
                </span>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold">{ind.name}</h3>
              <p className="mt-3 flex-1 text-white/55">{ind.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {ind.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70">{t}</span>
                ))}
              </div>
              <p className="mt-4 font-mono text-xs text-white/40">Best on: {ind.timeframes.join(' · ')}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
