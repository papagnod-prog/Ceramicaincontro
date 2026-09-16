import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useSamples, MAX_SAMPLES } from "@/context/SamplesContext";
import { Minus, Plus, ArrowLeft, Check, Beaker } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { addSample, items: sampleItems } = useSamples();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [area, setArea] = useState("");

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => setProduct(data)).catch(() => setProduct(false));
    setQty(1);
    window.scrollTo(0, 0);
  }, [id]);

  if (product === null)
    return <div className="max-w-7xl mx-auto px-4 py-24 animate-pulse text-[#78716C]">Caricamento…</div>;
  if (product === false)
    return <div className="max-w-7xl mx-auto px-4 py-24 text-center">Prodotto non trovato.</div>;

  const isArea = product.usage === "Rivestimento" || product.usage === "Pavimento";
  const boxesForArea =
    isArea && area && product.coverage_sqm > 0 ? Math.ceil(parseFloat(area) / product.coverage_sqm) : null;

  const specs = [
    ["Collezione", product.collection],
    ["Formato", product.format],
    ["Finitura", product.finish],
    ["Colore", product.color],
    ["Utilizzo", product.usage],
    ["Peso", `${product.weight_kg} kg / pz`],
    ["Copertura", `${product.coverage_sqm} m² / pz`],
  ];

  return (
    <div data-testid="pdp-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link to="/prodotti" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-8">
        <ArrowLeft className="w-4 h-4" /> Torna al negozio
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-[#F1EEE8] aspect-square overflow-hidden">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif-display text-8xl text-[#C0B9AE]">
              {product.collection?.[0]}
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow text-[#C05A3E] mb-3">{product.collection}</p>
          <h1 data-testid="pdp-product-title" className="font-serif-display text-4xl lg:text-5xl font-light leading-tight">
            {product.name}
          </h1>
          <div className="flex items-baseline gap-2 mt-5">
            <span className="text-3xl font-semibold">{eur(product.price)}</span>
            <span className="text-sm text-[#78716C]">{isArea ? "al m² · IVA inclusa" : "al pezzo · IVA inclusa"}</span>
          </div>
          <p className="text-[#57534E] leading-relaxed mt-6">{product.description}</p>

          {isArea && (
            <div data-testid="pdp-quantity-calculator" className="mt-8 bg-white border border-[#E2DDD5] p-6">
              <label className="eyebrow block mb-2">Calcolatore m²</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Superficie in m²"
                  className="flex-1 border border-[#E2DDD5] px-4 py-2.5 focus:outline-none focus:border-[#C05A3E]"
                  data-testid="sqm-input"
                />
                {boxesForArea && (
                  <button
                    onClick={() => setQty(boxesForArea)}
                    className="text-sm bg-[#F1EEE8] px-4 py-2.5 hover:bg-[#E2DDD5] transition-colors whitespace-nowrap"
                  >
                    ≈ {boxesForArea} pz →
                  </button>
                )}
              </div>
              {boxesForArea && (
                <p className="text-xs text-[#78716C] mt-2">
                  Per {area} m² servono circa {boxesForArea} pezzi ({product.coverage_sqm} m²/pz).
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mt-8">
            <div className="flex items-center border border-[#E2DDD5] bg-white">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3.5 hover:bg-[#F1EEE8]" data-testid="pdp-qty-decrease">
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-5 font-medium min-w-[3rem] text-center" data-testid="pdp-qty-value">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3.5 hover:bg-[#F1EEE8]" data-testid="pdp-qty-increase">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              data-testid="pdp-add-to-cart-btn"
              onClick={() => addItem(product, qty)}
              className="flex-1 bg-[#C05A3E] text-white py-4 text-sm font-semibold tracking-wide hover:bg-[#A64B32] transition-colors"
            >
              Aggiungi al carrello · {eur(product.price * qty)}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-[#6B7A6E]">
            <Check className="w-4 h-4" /> Disponibile · spedizione in tutta Italia
          </div>

          <button
            data-testid="pdp-request-sample-btn"
            onClick={() => addSample(product)}
            disabled={sampleItems?.some((i) => i.product_id === product.id)}
            className="mt-4 inline-flex items-center gap-2 border border-[#1C1917] text-[#1C1917] px-5 py-3 text-sm font-medium hover:bg-[#1C1917] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Beaker className="w-4 h-4" />
            {sampleItems?.some((i) => i.product_id === product.id)
              ? "Campione già richiesto"
              : "Richiedi campione gratuito"}
          </button>
          <p className="text-xs text-[#78716C] mt-2">
            Prova prima l'acquisto: campioni gratuiti fino a {MAX_SAMPLES} prodotti,{" "}
            <Link to="/campioni" className="underline hover:text-[#C05A3E]">vai al carrello campioni</Link>.
          </p>

          {/* Specs */}
          <div className="mt-10 border-t border-[#E2DDD5] pt-8">
            <h3 className="eyebrow mb-4">Scheda tecnica</h3>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-8">
              {specs.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[#E2DDD5]/70 pb-2">
                  <dt className="text-sm text-[#78716C]">{k}</dt>
                  <dd className="text-sm font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
