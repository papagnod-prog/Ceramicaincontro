import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { eur } from "@/lib/api";
import { Plus } from "lucide-react";

export const ProductCard = ({ product, index = 0 }) => {
  const { addItem } = useCart();
  return (
    <div
      data-testid="product-card-item"
      className="group ci-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      <Link to={`/prodotto/${product.id}`} className="block">
        <div className="relative overflow-hidden bg-[#F1EEE8] aspect-[4/5] mb-4">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="ci-hover-img w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#C0B9AE] font-serif-display text-5xl">
              {product.collection?.[0]}
            </div>
          )}
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 eyebrow text-[0.6rem] text-[#1C1917]">
            {product.collection}
          </span>
          <button
            data-testid="quick-add-btn"
            onClick={(e) => {
              e.preventDefault();
              addItem(product, 1);
            }}
            className="absolute bottom-3 right-3 bg-[#1C1917] text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-[#C05A3E]"
            aria-label="Aggiungi al carrello"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to={`/prodotto/${product.id}`}>
            <h3 className="font-medium text-[#1C1917] leading-snug hover:text-[#C05A3E] transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-xs text-[#78716C] mt-1">
            {product.format} · {product.finish}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-[#1C1917]">{eur(product.price)}</div>
          <div className="text-[0.65rem] text-[#78716C]">a confezione · iva esclusa</div>
        </div>
      </div>
    </div>
  );
};
