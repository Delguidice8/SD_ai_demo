export interface Position {
  ticker: string;
  qty: number; // positive long, negative short
  avg: number;
}

export interface Fill {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  time: number;
  realized: number;
}

export interface Account {
  cash: number;
  positions: Record<string, Position>;
  fills: Fill[];
}

export interface PriceAlert {
  id: string;
  ticker: string;
  price: number;
  dir: 'above' | 'below';
  created: number;
  triggered?: number;
}

export const STARTING_CASH = 100_000;

export const newAccount = (): Account => ({ cash: STARTING_CASH, positions: {}, fills: [] });

let seq = 1;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

/** Execute a market order and return the new account state. */
export function executeOrder(acc: Account, ticker: string, side: 'buy' | 'sell', qty: number, price: number): Account {
  const signed = side === 'buy' ? qty : -qty;
  const pos = acc.positions[ticker] ?? { ticker, qty: 0, avg: 0 };
  let realized = 0;
  let newQty = pos.qty + signed;
  let newAvg = pos.avg;

  if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
    // opening or adding
    newAvg = (pos.avg * Math.abs(pos.qty) + price * qty) / Math.abs(newQty);
  } else {
    // reducing / closing / flipping
    const closing = Math.min(Math.abs(signed), Math.abs(pos.qty));
    realized = closing * (price - pos.avg) * Math.sign(pos.qty);
    if (Math.abs(signed) > Math.abs(pos.qty)) newAvg = price;
    if (Math.abs(newQty) < 1e-9) {
      newQty = 0;
      newAvg = 0;
    }
  }

  const positions = { ...acc.positions };
  if (newQty === 0) delete positions[ticker];
  else positions[ticker] = { ticker, qty: newQty, avg: newAvg };

  const fill: Fill = { id: uid('f'), ticker, side, qty, price, time: Date.now(), realized };
  return { cash: acc.cash - signed * price, positions, fills: [fill, ...acc.fills].slice(0, 100) };
}

export function equity(acc: Account, priceOf: (t: string) => number) {
  let e = acc.cash;
  for (const p of Object.values(acc.positions)) e += p.qty * priceOf(p.ticker);
  return e;
}

export function unrealized(p: Position, price: number) {
  return (price - p.avg) * p.qty;
}
