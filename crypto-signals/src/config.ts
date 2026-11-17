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

export type Indicator = {
  name: string;
  short: string;
  description: string;
  timeframes: string[];
  tags: string[];
};

export const indicators: Indicator[] = [
  {
    name: 'Trend Vector',
    short: 'TV',
    description:
      'Trend-following overlay that flips colour when momentum and structure agree. Built to keep you in strong moves and out of the chop.',
    timeframes: ['1H', '4H', '1D'],
    tags: ['Trend', 'Overlay'],
  },
  {
    name: 'Reversal Radar',
    short: 'RR',
    description:
      'Spots exhaustion using divergence plus volume climax, and prints a buy or sell marker only when both line up.',
    timeframes: ['15m', '1H', '4H'],
    tags: ['Reversal', 'Oscillator'],
  },
  {
    name: 'Liquidity Zones',
    short: 'LZ',
    description:
      'Automatically maps the high-volume support and resistance levels where price is most likely to react.',
    timeframes: ['1H', '4H', '1D', '1W'],
    tags: ['Levels', 'Volume'],
  },
];

export type Tier = {
  name: string;
  monthly: number;
  yearly: number; // price per year
  blurb: string;
  features: string[];
  highlighted?: boolean;
  /** Stripe Payment Link (or any checkout URL). Leave empty → button opens the waitlist. */
  checkoutMonthly: string;
  checkoutYearly: string;
};

export const tiers: Tier[] = [
  {
    name: 'Starter',
    monthly: 29,
    yearly: 290,
    blurb: 'One indicator to sharpen your entries.',
    features: [
      'Access to 1 indicator of your choice',
      'TradingView invite-only script',
      'Daily market recap',
      'Community chat access',
    ],
    checkoutMonthly: '',
    checkoutYearly: '',
  },
  {
    name: 'Pro',
    monthly: 59,
    yearly: 590,
    blurb: 'The full toolkit plus real-time alerts.',
    features: [
      'All indicators, including future releases',
      'Real-time signal alerts (Discord + Telegram)',
      'Entry, stop-loss & take-profit levels',
      'Weekly strategy breakdown',
      'Priority support',
    ],
    highlighted: true,
    checkoutMonthly: '',
    checkoutYearly: '',
  },
  {
    name: 'Elite',
    monthly: 129,
    yearly: 1290,
    blurb: 'For active traders who want an edge on setup.',
    features: [
      'Everything in Pro',
      'Monthly 1-on-1 setup call',
      'Early access to beta indicators',
      'Private Elite channel',
    ],
    checkoutMonthly: '',
    checkoutYearly: '',
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
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your billing portal in one click and you keep access until the end of your billing period.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. The indicators and signals are educational tools. Crypto is highly volatile and you can lose money. Always do your own research and only risk what you can afford to lose.',
  },
];
