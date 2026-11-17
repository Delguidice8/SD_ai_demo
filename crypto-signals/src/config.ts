/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONFIG — edit this file to make the site yours.
 *  Brand name, indicators, pricing, checkout links and socials
 *  all live here. No other file needs to change for launch.
 * ─────────────────────────────────────────────────────────────
 */

export const brand = {
  name: 'Vector Signals', // ← your brand name
  tagline: 'Crypto indicators that tell you when — not just what.',
  supportEmail: 'support@example.com', // ← your support email
  socials: {
    x: '', // e.g. https://x.com/yourhandle
    discord: '', // e.g. https://discord.gg/yourinvite
    telegram: '', // e.g. https://t.me/yourchannel
    tradingview: '', // e.g. https://www.tradingview.com/u/yourname/
  },
};

/**
 * While SAMPLE_DATA is true, every chart, signal and stat on the
 * site is labelled "Sample" so visitors aren't misled. Replace the
 * sample data in `signals` below with your real track record, then
 * set this to false.
 */
export const SAMPLE_DATA = true;

/* ── PLANS ───────────────────────────────────────────────────
 * Plans are listed from cheapest to most expensive. Each plan
 * unlocks every indicator assigned to it PLUS everything from
 * the plans before it. The last plan unlocks everything.
 */

export type TierId = 'basic' | 'pro' | 'all';

export type Tier = {
  id: TierId;
  name: string;
  monthly: number;
  yearly: number; // price per year
  blurb: string;
  /** Extra perks besides the indicators (alerts, support, calls…). */
  perks: string[];
  /** Optional "was" price shown crossed out — use for the special deal. */
  compareAt?: { monthly: number; yearly: number };
  /** Badge on top of the card, e.g. "Best deal". */
  badge?: string;
  highlighted?: boolean;
  /** Stripe Payment Link (or any checkout URL). Leave empty → button opens the waitlist. */
  checkoutMonthly: string;
  checkoutYearly: string;
};

export const tiers: Tier[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthly: 29,
    yearly: 290,
    blurb: 'The core indicators to read the trend and key levels.',
    perks: ['TradingView invite-only access', 'Daily market recap', 'Community chat'],
    checkoutMonthly: '',
    checkoutYearly: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 59,
    yearly: 590,
    blurb: 'Adds timing tools and real-time alerts.',
    perks: [
      'Everything in Basic',
      'Real-time signal alerts (Discord + Telegram)',
      'Entry, stop-loss & take-profit levels',
      'Weekly strategy breakdown',
    ],
    checkoutMonthly: '',
    checkoutYearly: '',
  },
  {
    id: 'all',
    name: 'All Access',
    monthly: 99,
    yearly: 990,
    compareAt: { monthly: 149, yearly: 1490 },
    badge: 'Best deal · Everything unlocked',
    highlighted: true,
    blurb: 'Every indicator and strategy, plus everything we release next.',
    perks: [
      'Everything in Pro',
      'All future indicators included',
      'Private All Access channel',
      'Monthly 1-on-1 setup call',
      'Priority support',
    ],
    checkoutMonthly: '',
    checkoutYearly: '',
  },
];

/** Position of a plan in the list. Higher = more expensive. */
export const tierRank = (id: TierId) => tiers.findIndex((t) => t.id === id);
export const tierName = (id: TierId) => tiers.find((t) => t.id === id)?.name ?? id;

/* ── INDICATORS / STRATEGIES ─────────────────────────────────
 * Set `tier` to the CHEAPEST plan that unlocks it.
 * These are placeholders — swap in your real indicators.
 */

export type Indicator = {
  name: string;
  short: string;
  description: string;
  timeframes: string[];
  tags: string[];
  tier: TierId;
};

export const indicators: Indicator[] = [
  {
    name: 'Trend Vector',
    short: 'TV',
    tier: 'basic',
    description:
      'Trend-following overlay that flips colour when momentum and structure agree. Built to keep you in strong moves and out of the chop.',
    timeframes: ['1H', '4H', '1D'],
    tags: ['Trend', 'Overlay'],
  },
  {
    name: 'Liquidity Zones',
    short: 'LZ',
    tier: 'basic',
    description:
      'Automatically maps the high-volume support and resistance levels where price is most likely to react.',
    timeframes: ['1H', '4H', '1D', '1W'],
    tags: ['Levels', 'Volume'],
  },
  {
    name: 'Reversal Radar',
    short: 'RR',
    tier: 'pro',
    description:
      'Spots exhaustion using divergence plus volume climax, and prints a buy or sell marker only when both line up.',
    timeframes: ['15m', '1H', '4H'],
    tags: ['Reversal', 'Oscillator'],
  },
  {
    name: 'Momentum Pulse',
    short: 'MP',
    tier: 'pro',
    description:
      'Measures the strength behind a move so you can tell a real breakout from a fake-out before you enter.',
    timeframes: ['15m', '1H', '4H'],
    tags: ['Momentum', 'Breakouts'],
  },
  {
    name: 'Whale Flow',
    short: 'WF',
    tier: 'all',
    description:
      'Flags unusual volume spikes and large-order footprints that often show up before big moves.',
    timeframes: ['5m', '15m', '1H'],
    tags: ['Volume', 'Order flow'],
  },
  {
    name: 'Cycle Compass',
    short: 'CC',
    tier: 'all',
    description:
      'A higher-timeframe market regime model that tells you whether to favour longs, shorts or sitting out.',
    timeframes: ['1D', '1W'],
    tags: ['Macro', 'Strategy'],
  },
];

/**
 * Waitlist / email capture. Paste a form endpoint (Formspree,
 * Basin, Getform, ConvertKit, etc.). If empty, the form shows a
 * success message but does NOT save the email anywhere.
 */
export const waitlistFormAction = '';

export type Signal = {
  pair: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number | null; // null = still open
  timeframe: string;
  indicator: string;
  date: string;
};

// SAMPLE signals for layout only. Replace with your real history.
export const signals: Signal[] = [
  { pair: 'BTC/USDT', side: 'LONG', entry: 91240, exit: null, timeframe: '4H', indicator: 'Trend Vector', date: '2026-11-16' },
  { pair: 'ETH/USDT', side: 'LONG', entry: 3412, exit: 3588, timeframe: '1H', indicator: 'Reversal Radar', date: '2026-11-14' },
  { pair: 'SOL/USDT', side: 'SHORT', entry: 212.4, exit: 198.1, timeframe: '4H', indicator: 'Trend Vector', date: '2026-11-12' },
  { pair: 'LINK/USDT', side: 'LONG', entry: 18.92, exit: 18.31, timeframe: '1H', indicator: 'Reversal Radar', date: '2026-11-10' },
  { pair: 'BTC/USDT', side: 'SHORT', entry: 94880, exit: 92150, timeframe: '1D', indicator: 'Liquidity Zones', date: '2026-11-07' },
  { pair: 'AVAX/USDT', side: 'LONG', entry: 34.1, exit: 37.6, timeframe: '4H', indicator: 'Trend Vector', date: '2026-11-04' },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: 'How do I get access after subscribing?',
    a: 'After checkout you will receive an email asking for your TradingView username. We grant access to the invite-only scripts, usually within a few hours, and send your Discord/Telegram invite for alerts.',
  },
  {
    q: 'Do I need a paid TradingView plan?',
    a: 'No. Invite-only scripts work on the free TradingView plan. A paid plan just lets you set more alerts and use more indicators per chart.',
  },
  {
    q: 'Which exchanges and coins does this work on?',
    a: 'The indicators work on any chart TradingView supports. Our alerts focus on major pairs like BTC, ETH, SOL and other high-liquidity assets.',
  },
  {
    q: 'Can I upgrade my plan later?',
    a: 'Yes. Upgrade anytime and the extra indicators are unlocked on your TradingView account, usually within a few hours.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your billing portal in one click and you keep access until the end of your billing period.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. The indicators and signals are educational tools. Crypto is highly volatile and you can lose money. Always do your own research and only risk what you can afford to lose.',
  },
];
