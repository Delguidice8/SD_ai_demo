import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { waitlistFormAction } from '../config';

export default function Waitlist() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!waitlistFormAction) {
      console.warn('waitlistFormAction is empty in src/config.ts, so this email was not saved.');
      setState('done');
      return;
    }
    setState('sending');
    try {
      const res = await fetch(waitlistFormAction, {
        method: 'POST',
        body: new FormData(e.currentTarget),
        headers: { Accept: 'application/json' },
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <section id="waitlist" className="container-x pb-24 sm:pb-32">
      <div className="relative overflow-hidden rounded-3xl bg-lime-signal px-6 py-14 text-ink sm:px-14">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border-[40px] border-ink/10" aria-hidden />
        <div className="relative max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Get the next signal before everyone else.</h2>
          <p className="mt-3 text-ink/70">Join the list for launch pricing, free indicator previews and a weekly market recap.</p>
          {state === 'done' ? (
            <p className="mt-8 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> You're on the list. Watch your inbox.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@email.com"
                className="h-12 flex-1 rounded-full border-0 bg-white px-5 text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <button
                disabled={state === 'sending'}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white transition hover:bg-ink-700 disabled:opacity-60"
              >
                {state === 'sending' ? 'Joining…' : 'Join the list'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
          {state === 'error' && <p className="mt-3 text-sm font-medium">Something went wrong. Please try again.</p>}
        </div>
      </div>
    </section>
  );
}
