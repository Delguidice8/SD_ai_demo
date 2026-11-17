import { Plus } from 'lucide-react';
import { faqs } from '../config';

export default function FAQ() {
  return (
    <section id="faq" className="container-x grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.6fr]">
      <div>
        <p className="eyebrow mb-4">FAQ</p>
        <h2 className="h-section">Questions, answered.</h2>
      </div>
      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {faqs.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus className="h-5 w-5 shrink-0 text-white/40 transition group-open:rotate-45 group-open:text-lime-signal" />
            </summary>
            <p className="mt-3 pr-10 text-white/55">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
