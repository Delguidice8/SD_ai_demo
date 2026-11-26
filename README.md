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
- Live (simulated) price feed with a watchlist, symbol search (just start typing), symbol details and performance
- Paper trading: $100k account, market orders, long/short positions with live P&L drawn on the chart
- Price alerts with sound and notifications; dark and light themes; PNG snapshots; layout saved in the browser

Market data is simulated for demonstration; it is not real market data.

Code lives in `src/terminal/` (`chart/engine.ts` is the rendering and interaction engine).
