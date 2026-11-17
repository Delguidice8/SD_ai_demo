import { useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { indicators, tierRank, tiers } from '../config';

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="relative border-y border-white/[0.06] bg-ink-900/50 py-24 sm:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">Pricing</p>
          <h2 className="h-section">Unlock more as you level up.</h2>
          <p className="mt-5 text-lg text-white/55">
            Every plan builds on the one before it. Or grab the All Access deal and get everything at once.
          </p>

          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-ink p-1 text-sm" role="group" aria-label="Billing period">
            {[false, true].map((y) => (
              <button
                key={String(y)}
                onClick={() => setYearly(y)}
                aria-pressed={yearly === y}
                className={`rounded-full px-5 py-2 font-medium transition ${yearly === y ? 'bg-white text-ink' : 'text-white/60 hover:text-white'}`}
              >
                {y ? 'Yearly · 2 months free' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 grid items-stretch gap-5 lg:grid-cols-3">
          {tiers.map((t, rank) => {
            const price = yearly ? Math.round(t.yearly / 12) : t.monthly;
            const was = t.compareAt ? (yearly ? Math.round(t.compareAt.yearly / 12) : t.compareAt.monthly) : null;
            const href = (yearly ? t.checkoutYearly : t.checkoutMonthly) || '#waitlist';
            const unlocked = indicators.filter((ind) => tierRank(ind.tier) <= rank).length;
            const isAll = unlocked === indicators.length;

            return (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  t.highlighted
                    ? 'border-lime-signal/60 bg-ink-800 shadow-[0_30px_80px_-30px_rgba(198,244,50,0.35)]'
                    : 'border-white/[0.07] bg-ink'
                }`}
              >
                {t.badge && (
                  <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 rounded-full bg-lime-signal px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
                    <Sparkles className="h-3 w-3" /> {t.badge}
                  </span>
                )}
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
                <p className="mt-2 min-h-[2.5rem] text-sm text-white/50">{t.blurb}</p>

                <p className="mt-6 flex items-baseline gap-2">
                  {was !== null && <span className="text-xl text-white/35 line-through">${was}</span>}
                  <span className="font-display text-5xl font-bold">${price}</span>
                  <span className="text-white/45">/mo</span>
                </p>
                <p className="mt-1 h-5 text-sm text-white/40">
                  {yearly ? `$${t.yearly} billed yearly` : ''}
                  {!yearly && was !== null ? <span className="text-lime-signal">Save ${was - price}/mo</span> : null}
                </p>

                <div className="mt-8">
                  <p className="font-mono text-xs uppercase tracking-wider text-white/40">
                    Indicators · {isAll ? 'all ' : ''}{unlocked} of {indicators.length}
                  </p>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {indicators.map((ind) => {
                      const on = tierRank(ind.tier) <= rank;
                      return (
                        <li key={ind.name} className={`flex items-center gap-3 ${on ? 'text-white/85' : 'text-white/30'}`}>
                          {on ? (
                            <Check className="h-4 w-4 shrink-0 text-lime-signal" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-label="Locked" />
                          )}
                          {ind.name}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-6 flex-1 border-t border-white/[0.07] pt-6">
                  <ul className="space-y-2.5 text-sm">
                    {t.perks.map((f) => (
                      <li key={f} className="flex gap-3 text-white/65">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/35" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <a href={href} className={`mt-10 w-full ${t.highlighted ? 'btn-primary' : 'btn-ghost'}`}>
                  {isAll ? `Unlock everything` : `Get ${t.name}`}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
