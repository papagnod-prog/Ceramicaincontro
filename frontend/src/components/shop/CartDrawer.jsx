import { useCart } from "@/context/CartContext";
import { eur } from "@/lib/api";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CartDrawer = () => {
  const { items, open, setOpen, updateQty, removeItem, subtotal, weight, count } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        data-testid="shopping-cart-drawer"
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-[#F8F6F2] z-[70] shadow-2xl flex flex-col transition-transform duration-400 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2DDD5]">
          <h2 className="font-serif-display text-2xl">Carrello ({count})</h2>
          <button onClick={() => setOpen(false)} data-testid="cart-close-btn" className="p-2 hover:bg-[#F1EEE8] rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <ShoppingBag className="w-12 h-12 text-[#C0B9AE]" strokeWidth={1} />
            <p className="text-[#78716C]">Il tuo carrello è vuoto.</p>
            <button
              onClick={() => {
                setOpen(false);
                navigate("/prodotti");
              }}
              className="mt-2 bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#C05A3E] transition-colors"
            >
              Esplora le collezioni
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 no-scrollbar">
              {items.map((i) => (
                <div key={i.product_id} data-testid="cart-item-row" className="flex gap-4">
                  <div className="w-20 h-24 bg-[#F1EEE8] overflow-hidden shrink-0">
                    {i.image && <img src={i.image} alt={i.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="eyebrow text-[0.6rem] text-[#C05A3E]">{i.collection}</p>
                        <p className="font-medium text-sm truncate">{i.name}</p>
                        <p className="text-xs text-[#78716C]">{i.format}</p>
                      </div>
                      <button onClick={() => removeItem(i.product_id)} className="text-[#A8A29E] hover:text-[#C05A3E] shrink-0" aria-label="Rimuovi">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-[#E2DDD5] bg-white">
                        <button onClick={() => updateQty(i.product_id, i.quantity - 1)} className="px-2 py-1.5 hover:bg-[#F1EEE8]" data-testid="cart-qty-decrease">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-sm min-w-[2rem] text-center">{i.quantity}</span>
                        <button onClick={() => updateQty(i.product_id, i.quantity + 1)} className="px-2 py-1.5 hover:bg-[#F1EEE8]" data-testid="cart-qty-increase">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold text-sm">{eur(i.price * i.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E2DDD5] px-6 py-5 space-y-3 bg-[#F8F6F2]">
              <div className="flex justify-between text-sm">
                <span className="text-[#78716C]">Subtotale</span>
                <span className="font-semibold">{eur(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#78716C]">
                <span>Peso stimato</span>
                <span>{weight.toFixed(1)} kg</span>
              </div>
              <p className="text-xs text-[#78716C]">Spedizione calcolata al checkout.</p>
              <button
                data-testid="cart-checkout-button"
                onClick={goCheckout}
                className="w-full bg-[#C05A3E] text-white py-4 text-sm font-semibold tracking-wide hover:bg-[#A64B32] transition-colors"
              >
                Procedi al checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
};
