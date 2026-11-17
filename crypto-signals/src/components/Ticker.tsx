import { useEffect, useState } from 'react';

type Coin = { id: string; sym: string };
const COINS: Coin[] = [
  { id: 'bitcoin', sym: 'BTC' }, { id: 'ethereum', sym: 'ETH' }, { id: 'solana', sym: 'SOL' },
  { id: 'binancecoin', sym: 'BNB' }, { id: 'ripple', sym: 'XRP' }, { id: 'chainlink', sym: 'LINK' },
  { id: 'avalanche-2', sym: 'AVAX' }, { id: 'dogecoin', sym: 'DOGE' },
];

type Price = { sym: string; usd: number; change: number };

/** Live prices from CoinGecko's free public API. Hides itself if the request fails. */
export default function Ticker() {
  const [prices, setPrices] = useState<Price[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const ids = COINS.map((c) => c.id).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!alive) return;
        setPrices(
          COINS.filter((c) => data[c.id]).map((c) => ({ sym: c.sym, usd: data[c.id].usd, change: data[c.id].usd_24h_change ?? 0 }))
        );
      } catch {
        /* keep previous prices, or stay hidden */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!prices?.length) return null;

  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : n < 100 ? 2 : 0 });
  const row = prices.map((p) => (
    <span key={p.sym} className="flex items-center gap-2 whitespace-nowrap px-6">
      <span className="text-white/80">{p.sym}</span>
      <span className="text-white">${fmt(p.usd)}</span>
      <span className={p.change >= 0 ? 'text-bull' : 'text-bear'}>{p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%</span>
    </span>
  ));

  return (
    <div className="mt-20 border-y border-white/[0.06] bg-ink-900/60 py-3 font-mono text-sm" aria-label="Live crypto prices">
      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee">{row}{row}</div>
      </div>
    </div>
  );
}
