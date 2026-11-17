import { useState } from 'react';
import { Check } from 'lucide-react';
import { tiers } from '../config';

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="relative border-y border-white/[0.06] bg-ink-900/50 py-24 sm:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">Pricing</p>
          <h2 className="h-section">Pick your edge.</h2>
          <p className="mt-5 text-lg text-white/55">Simple plans. No contracts. Cancel in one click.</p>

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

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {tiers.map((t) => {
            const price = yearly ? Math.round(t.yearly / 12) : t.monthly;
            const href = (yearly ? t.checkoutYearly : t.checkoutMonthly) || '#waitlist';
            return (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  t.highlighted ? 'border-lime-signal/60 bg-ink-800 shadow-[0_30px_80px_-30px_rgba(198,244,50,0.35)]' : 'border-white/[0.07] bg-ink'
                }`}
              >
                {t.highlighted && (
                  <span className="absolute -top-3 left-8 rounded-full bg-lime-signal px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
                <p className="mt-2 text-sm text-white/50">{t.blurb}</p>
                <p className="mt-8 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold">${price}</span>
                  <span className="text-white/45">/mo</span>
                </p>
                <p className="mt-1 h-5 text-sm text-white/40">{yearly ? `$${t.yearly} billed yearly` : ''}</p>
                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-3 text-white/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-signal" /> {f}
                    </li>
                  ))}
                </ul>
                <a href={href} className={`mt-10 w-full ${t.highlighted ? 'btn-primary' : 'btn-ghost'}`}>
                  Get {t.name}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
