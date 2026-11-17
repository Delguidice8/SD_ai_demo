import { useEffect, useState } from 'react';
import { Activity, Menu, X } from 'lucide-react';
import { brand } from '../config';

const links = [
  { href: '#indicators', label: 'Indicators' },
  { href: '#how', label: 'How it works' },
  { href: '#signals', label: 'Signals' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition ${scrolled || open ? 'border-b border-white/[0.06] bg-ink/85 backdrop-blur-lg' : ''}`}>
      <nav className="container-x flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-signal text-ink">
            <Activity className="h-4 w-4" strokeWidth={2.75} />
          </span>
          {brand.name}
        </a>
        <ul className="hidden items-center gap-8 text-sm text-white/65 md:flex">
          {links.map((l) => (
            <li key={l.href}><a href={l.href} className="transition hover:text-white">{l.label}</a></li>
          ))}
        </ul>
        <a href="#pricing" className="btn-primary hidden !px-5 !py-2 text-sm md:inline-flex">Get access</a>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <ul className="container-x flex flex-col gap-1 pb-4 md:hidden">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-white/80 hover:bg-white/5">{l.label}</a>
            </li>
          ))}
          <li><a href="#pricing" onClick={() => setOpen(false)} className="btn-primary mt-2 w-full">Get access</a></li>
        </ul>
      )}
    </header>
  );
}
