import { ArrowRight, BellRing, ShieldCheck, Zap } from 'lucide-react';
import SignalChart from './SignalChart';
import { brand, SAMPLE_DATA } from '../config';

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div className="absolute left-1/2 top-24 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-lime-signal/10 blur-[120px]" aria-hidden />

      <div className="container-x relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-5">Crypto indicators · Real-time alerts</p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Stop guessing.<br />
            <span className="text-lime-signal">Trade the signal.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
            {brand.tagline} Get our TradingView indicators plus instant buy/sell alerts on Discord and Telegram.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#pricing" className="btn-primary w-full sm:w-auto">
              Start trading smarter <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#signals" className="btn-ghost w-full sm:w-auto">See recent signals</a>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/50">
            <li className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-lime-signal" /> Works on free TradingView</li>
            <li className="flex items-center gap-1.5"><BellRing className="h-4 w-4 text-lime-signal" /> Instant alerts</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-lime-signal" /> Cancel anytime</li>
          </ul>
        </div>

        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="panel overflow-hidden shadow-[0_40px_120px_-30px_rgba(198,244,50,0.25)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="font-semibold text-white">BTC/USDT</span>
                <span className="text-white/40">4H</span>
                <span className="hidden text-white/40 sm:inline">Trend Vector + Reversal Radar</span>
              </div>
              {SAMPLE_DATA ? <span className="sample-badge">Sample chart</span> : <span className="font-mono text-xs text-bull">● Live</span>}
            </div>
            <div className="aspect-[16/8] p-2 sm:p-4">
              <SignalChart />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
