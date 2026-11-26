import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function IconButton({
  children,
  title,
  active,
  onClick,
  className = '',
}: {
  children: ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-t-accent/15 text-t-accent' : 'text-t-muted hover:bg-t-hover hover:text-t-text'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, width = 'max-w-lg' }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`pop-in flex max-h-[80vh] w-full ${width} flex-col overflow-hidden rounded-xl border border-t-border bg-t-elev shadow-2xl shadow-black/40`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-t-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-t-text">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-t-muted hover:bg-t-hover hover:text-t-text" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SymbolBadge({ ticker, size = 22 }: { ticker: string; size?: number }) {
  // deterministic hue from ticker
  let h = 0;
  for (const ch of ticker) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, hsl(${h} 62% 52%), hsl(${(h + 40) % 360} 62% 40%))` }}
    >
      {ticker.replace(/[^A-Z]/g, '').slice(0, 1)}
    </span>
  );
}
