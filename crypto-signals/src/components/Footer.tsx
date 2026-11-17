import { Activity } from 'lucide-react';
import { brand } from '../config';

const label: Record<string, string> = { x: 'X / Twitter', discord: 'Discord', telegram: 'Telegram', tradingview: 'TradingView' };

export default function Footer() {
  const socials = Object.entries(brand.socials).filter(([, url]) => url);

  return (
    <footer className="border-t border-white/[0.06] py-14 text-sm text-white/45">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <p className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-lime-signal text-ink">
                <Activity className="h-3.5 w-3.5" strokeWidth={2.75} />
              </span>
              {brand.name}
            </p>
            <p className="mt-3">
              Questions?{' '}
              <a className="text-white/70 underline-offset-4 hover:underline" href={`mailto:${brand.supportEmail}`}>
                {brand.supportEmail}
              </a>
            </p>
          </div>
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-6">
              {socials.map(([k, url]) => (
                <li key={k}>
                  <a href={url} target="_blank" rel="noreferrer" className="hover:text-white">{label[k]}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-10 max-w-4xl text-xs leading-relaxed text-white/35">
          <strong className="text-white/50">Risk disclaimer:</strong> {brand.name} provides indicators and trade ideas for educational and
          informational purposes only. Nothing here is financial, investment or trading advice. Cryptocurrency trading carries a high level
          of risk and may not be suitable for everyone. You could lose some or all of your capital. Past performance is not indicative of
          future results. Always do your own research.
        </p>
        <p className="mt-6 text-xs text-white/30">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
