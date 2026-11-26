# SD_ai_demo

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/Delguidice8/SD_ai_demo)
## Vantage Charts (`/terminal.html`)

A browser-based charting and paper-trading terminal, built with React, TypeScript and a custom HTML canvas chart engine (no charting library).

Run `npm run dev` and open `http://localhost:5173/terminal.html`.

**Features**

- Candles, hollow candles, Heikin Ashi, OHLC bars, line and area charts
- Timeframes from 1m to 1W, quick ranges (1D … All), pan, wheel/pinch zoom, axis drag scaling, log scale
- Indicators: MA, EMA, Bollinger Bands, VWAP, RSI, MACD, Stochastic, ATR — each configurable, hideable and removable
- Drawing tools: trend line, ray, horizontal/vertical line, rectangle, Fibonacci retracement, measure; magnet snapping, lock, hide; drag to edit; Del to delete
- Real market data (see below), a watchlist, symbol search (just start typing), symbol details and performance
- Paper trading: $100k account, market orders, long/short positions with live P&L drawn on the chart
- Price alerts with sound and notifications; dark and light themes; PNG snapshots; layout saved in the browser

### Market data

| Source | Covers | Key | What you get |
| --- | --- | --- | --- |
| Coinbase Exchange | BTC, ETH, SOL | none | Real-time streaming prices and candle history |
| [Finnhub](https://finnhub.io/register) | Stocks, ETFs, forex, gold, oil | free | Real-time streaming prices and daily quotes |
| [Twelve Data](https://twelvedata.com/pricing) | Stocks, ETFs, forex, gold, oil | free | Candle history on every timeframe; delayed quotes when Finnhub isn't set |

Add keys in the app under **Data** (top bar). They are stored only in your browser and sent only to that provider. With both keys every symbol is real; with neither, crypto is real and everything else is simulated and labelled `SIM`. The legend shows each chart's source (Real-time, Delayed, or Simulated).

Twelve Data's free plan allows 8 requests a minute and 800 a day, so the app rations it: chart history first, then quote polling about once a minute for the open symbol.

Real data only loads where the app runs as a normal web page (`npm run dev`, or any static hosting of `npm run build`); claude.ai artifact previews block outside network requests and fall back to simulated prices.

Code lives in `src/terminal/` (`chart/engine.ts` is the rendering and interaction engine).
