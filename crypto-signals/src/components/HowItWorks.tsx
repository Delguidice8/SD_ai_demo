import { BellRing, CreditCard, LineChart } from 'lucide-react';

const steps = [
  { icon: CreditCard, title: 'Subscribe', text: 'Pick a plan and check out securely. Monthly or yearly, cancel anytime.' },
  { icon: LineChart, title: 'Get TradingView access', text: 'Send us your TradingView username and the indicators appear in your "Invite-only scripts".' },
  { icon: BellRing, title: 'Follow the alerts', text: 'Join the members-only Discord and Telegram, where every signal is posted with entry, stop and targets.' },
];

export default function HowItWorks() {
  return (
    <section id="how" className="border-y border-white/[0.06] bg-ink-900/50 py-24 sm:py-32">
      <div className="container-x">
        <p className="eyebrow mb-4">How it works</p>
        <h2 className="h-section max-w-2xl">From checkout to your first signal in minutes.</h2>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-ink-900 p-8">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-lime-signal">0{i + 1}</span>
                <span className="h-px flex-1 bg-white/10" />
                <s.icon className="h-5 w-5 text-white/50" />
              </div>
              <h3 className="mt-8 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-white/55">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
