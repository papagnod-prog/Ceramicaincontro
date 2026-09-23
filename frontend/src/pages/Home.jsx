import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import { ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const HERO = "https://images.unsplash.com/photo-1763485956232-45c74e1e8610?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

const COLLECTION_TILES = [
  { name: "SMUSSO", tag: "Il battiscopa a 30°", img: "https://images.unsplash.com/photo-1489272889853-8093472c6f42?crop=entropy&cs=srgb&fm=jpg&q=85&w=900" },
  { name: "Moon Spots", tag: "Rivestimento 9x60", img: "https://images.unsplash.com/photo-1512119706465-5f60cf4d3e2d?crop=entropy&cs=srgb&fm=jpg&q=85&w=900" },
  { name: "Stony", tag: "Effetto pietra", img: "https://images.unsplash.com/photo-1763485955425-a61e722832ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=900" },
  { name: "Paper Glass", tag: "Riflessi di vetro", img: "https://images.unsplash.com/photo-1673731535556-665e8b8041fe?crop=entropy&cs=srgb&fm=jpg&q=85&w=900" },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  usePageTitle(null);

  useEffect(() => {
    api.get("/products?sort=featured").then(({ data }) => setFeatured(data.filter((p) => p.featured).slice(0, 8)));
  }, []);

  return (
    <div data-testid="home-page">
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[560px] w-full overflow-hidden">
        <img src={HERO} alt="Ceramica Incontro" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
          <p className="eyebrow text-[#E7C9BE] mb-5 ci-fade-up">fittile_ · dal 1976</p>
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
          </div>
        </div>
      </section>

      {/* Collections bento */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow text-[#C05A3E] mb-2">Le collezioni</p>
            <h2 className="font-serif-display text-4xl lg:text-5xl font-light">Superfici che raccontano</h2>
          </div>
          <Link to="/prodotti" className="hidden sm:inline text-sm font-medium ci-link-underline">Vedi tutto</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {COLLECTION_TILES.map((c, i) => (
            <Link
              key={c.name}
              to={`/prodotti?collection=${encodeURIComponent(c.name)}`}
              className="group relative aspect-[3/4] overflow-hidden ci-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <img src={c.img} alt={c.name} className="ci-hover-img w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5">
                <p className="text-white/80 text-xs uppercase tracking-widest">{c.tag}</p>
                <h3 className="font-serif-display text-white text-2xl">{c.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="mb-10">
          <p className="eyebrow text-[#C05A3E] mb-2">In evidenza</p>
          <h2 className="font-serif-display text-4xl lg:text-5xl font-light">Prodotti selezionati</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
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
