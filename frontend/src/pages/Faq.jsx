import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { parseInline } from "@/lib/seo.mjs";
import { COMPANY } from "@/lib/company";
import faq from "@/lib/faq.json";

const Inline = ({ text }) =>
  parseInline(text).map((t, i) => {
    if (t.type === "bold") return <strong key={i}>{t.text}</strong>;
    if (t.type === "link") {
      return t.href.startsWith("/") ? (
        <Link key={i} to={t.href}>{t.text}</Link>
      ) : (
        <a key={i} href={t.href}>{t.text}</a>
      );
    }
    return <span key={i}>{t.text}</span>;
  });

const Answer = ({ blocks }) => (
  <div className="space-y-2 text-[#44403C] leading-relaxed [&_a]:text-[#A64B32] [&_a]:underline">
    {blocks.map((b, i) =>
      typeof b === "string" ? (
        <p key={i}><Inline text={b} /></p>
      ) : (
        <ul key={i} className="list-disc pl-6 space-y-1">
          {b.list.map((li, j) => <li key={j}><Inline text={li} /></li>)}
        </ul>
      ),
    )}
  </div>
);

export default function Faq() {
  usePageTitle("Domande frequenti");
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12" data-testid="faq-page">
      <h1 className="font-serif-display text-4xl font-light mb-3">Domande frequenti</h1>
      <p className="text-sm text-[#57534E] mb-8">
        Non trovi la risposta? Scrivi a{" "}
        <a href={`mailto:${COMPANY.email}`} className="text-[#A64B32] underline">{COMPANY.email}</a> o chiama il{" "}
        {COMPANY.phoneIntl}, dal lunedì al venerdì, 9:00-13:00 e 15:00-18:00.
      </p>

      <nav aria-label="Argomenti" className="flex flex-wrap gap-2 mb-10">
        {faq.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-xs border border-[#E2DDD5] bg-white px-3 py-1.5 hover:border-[#C05A3E] transition-colors">
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {faq.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24" data-testid={`faq-section-${s.id}`}>
            <h2 id={`${s.id}-title`} className="font-serif-display text-2xl mb-2">{s.title}</h2>
            <Accordion type="multiple" className="border-t border-[#E2DDD5]">
              {s.items.map((item, i) => (
                <AccordionItem key={i} value={`${s.id}-${i}`} className="border-[#E2DDD5]">
                  <AccordionTrigger className="text-base text-[#1C1917]" data-testid={`faq-q-${s.id}-${i}`}>{item.q}</AccordionTrigger>
                  <AccordionContent>
                    <Answer blocks={item.a} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </div>
  );
}
