import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const HERO = "/store/img/ceramica_incontro.png";

export default function Home() {
  usePageTitle(null);

  return (
    <div data-testid="home-page">
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[560px] w-full overflow-hidden">
        <img src={HERO} alt="Ceramica Incontro" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
          <p className="eyebrow text-[#E7C9BE] mb-5 ci-fade-up">since 1976</p>
          <h1 className="font-serif-display font-light text-white text-5xl sm:text-6xl lg:text-7xl leading-[1.05] max-w-2xl ci-fade-up" style={{ animationDelay: "80ms" }}>
            L'innovazione<br />del battiscopa.
          </h1>
          <p className="text-white/85 max-w-md mt-6 text-base sm:text-lg font-light ci-fade-up" style={{ animationDelay: "160ms" }}>
            Ceramiche e profili architettonici prodotti a Corato. Battiscopa, rivestimenti e
            pavimenti in gres, con stampa digitale ad altissima definizione.
          </p>
          <div className="flex flex-wrap gap-4 mt-9 ci-fade-up" style={{ animationDelay: "240ms" }}>
            <Link to="/prodotti" data-testid="hero-shop-btn" className="group bg-[#C05A3E] text-white px-8 py-4 text-sm font-semibold tracking-wide hover:bg-[#A64B32] transition-colors inline-flex items-center gap-2">
              Esplora il negozio
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/prodotti?collection=SMUSSO" className="border border-white/50 text-white px-8 py-4 text-sm font-semibold tracking-wide hover:bg-white hover:text-[#1C1917] transition-colors">
              Scopri SMUSSO
            </Link>
            <Link to="/prodotti?collection=Battiscopa" data-testid="hero-8x33-btn" className="border border-white/50 text-white px-8 py-4 text-sm font-semibold tracking-wide hover:bg-white hover:text-[#1C1917] transition-colors">
              Scopri 8x33
            </Link>
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#E2DDD5] pt-12">
          {[
            ["Made in Corato", "Produzione italiana dal 1976, distretto ceramico d'eccellenza."],
            ["Spedizione su bancale", "Consegna in tutta Italia, con calcolo del peso in tempo reale."],
            ["Pagamenti sicuri", "Checkout protetto con Stripe. Carte, Apple Pay e Google Pay."],
          ].map(([t, d]) => (
            <div key={t}>
              <h4 className="font-serif-display text-2xl mb-2">{t}</h4>
              <p className="text-sm text-[#57534E] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
