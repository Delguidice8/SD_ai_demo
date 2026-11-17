import { indicators } from '../config';

export default function Indicators() {
  return (
    <section id="indicators" className="container-x py-24 sm:py-32">
      <div className="max-w-2xl">
        <p className="eyebrow mb-4">The toolkit</p>
        <h2 className="h-section">Indicators built for one job: clearer decisions.</h2>
        <p className="mt-5 text-lg text-white/55">
          Each tool runs as an invite-only script on TradingView. Add it to any chart, any coin, any timeframe.
        </p>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {indicators.map((ind, i) => (
          <article key={ind.name} className="panel group relative flex flex-col p-7 transition hover:border-lime-signal/40">
            <div className="flex items-start justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-ink-800 font-mono text-sm font-semibold text-lime-signal">
                {ind.short}
              </span>
              <span className="font-mono text-xs text-white/30">0{i + 1}</span>
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
        ))}
      </div>
    </section>
  );
}
