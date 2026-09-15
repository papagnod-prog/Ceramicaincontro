import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Truck } from "lucide-react";

export default function Checkout() {
  const { items, subtotal, weight, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [options, setOptions] = useState([]);
  const [shipId, setShipId] = useState("standard");
  const [shippingCost, setShippingCost] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "", name: "", phone: "",
    line1: "", city: "", postal_code: "", province: "",
    vat_number: "", codice_fiscale: "", company: "",
  });

  useEffect(() => {
    if (items.length === 0) navigate("/negozio");
  }, [items, navigate]);

  useEffect(() => {
    api.get("/shipping/options").then(({ data }) => setOptions(data));
  }, []);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, email: f.email || user.email, name: f.name || user.name }));
  }, [user]);

  useEffect(() => {
    if (items.length === 0) return;
    api
      .post("/shipping/quote", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_option_id: shipId,
      })
      .then(({ data }) => setShippingCost(data.shipping_cost))
      .catch(() => {});
  }, [shipId, items]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const total = subtotal + shippingCost;

  const placeOrder = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/checkout", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_option_id: shipId,
        customer: { email: form.email, name: form.name, phone: form.phone },
        shipping_address: {
          line1: form.line1, city: form.city, postal_code: form.postal_code,
          province: form.province, country: "IT",
        },
        billing: { vat_number: form.vat_number, codice_fiscale: form.codice_fiscale, company: form.company },
        origin_url: window.location.origin,
      });
      clear();
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
      toast.error("Errore durante il checkout");
      setBusy(false);
    }
  };

  const inputCls = "w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E] text-sm";

  return (
    <div data-testid="checkout-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-serif-display text-4xl lg:text-5xl font-light mb-2">Checkout</h1>
      <p className="text-sm text-[#78716C] mb-10">
        {user ? `Ordine come ${user.email}` : "Stai ordinando come ospite. "}
        {!user && <button onClick={() => navigate("/login")} className="text-[#C05A3E] ci-link-underline">Accedi</button>}
      </p>

      {error && <div className="bg-[#FBEAE5] text-[#A64B32] text-sm px-4 py-3 mb-6" data-testid="checkout-error">{error}</div>}

      <form onSubmit={placeOrder} className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10" data-testid="checkout-shipping-form">
          {/* Contact */}
          <section>
            <h2 className="eyebrow mb-4 text-[#C05A3E]">1 · Contatti</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input className={inputCls} placeholder="Email" type="email" required value={form.email} onChange={set("email")} data-testid="checkout-email" />
              <input className={inputCls} placeholder="Nome e cognome" required value={form.name} onChange={set("name")} data-testid="checkout-name" />
              <input className={inputCls + " sm:col-span-2"} placeholder="Telefono" value={form.phone} onChange={set("phone")} data-testid="checkout-phone" />
            </div>
          </section>

          {/* Address */}
          <section>
            <h2 className="eyebrow mb-4 text-[#C05A3E]">2 · Indirizzo di spedizione</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input className={inputCls + " sm:col-span-2"} placeholder="Indirizzo e civico" required value={form.line1} onChange={set("line1")} data-testid="checkout-line1" />
              <input className={inputCls} placeholder="Città" required value={form.city} onChange={set("city")} data-testid="checkout-city" />
              <input className={inputCls} placeholder="CAP" required value={form.postal_code} onChange={set("postal_code")} data-testid="checkout-cap" />
              <input className={inputCls} placeholder="Provincia (es. MO)" value={form.province} onChange={set("province")} data-testid="checkout-province" />
            </div>
          </section>

          {/* Billing */}
          <section>
            <h2 className="eyebrow mb-4 text-[#C05A3E]">3 · Fatturazione (opzionale)</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input className={inputCls} placeholder="Ragione sociale" value={form.company} onChange={set("company")} data-testid="checkout-company" />
              <input className={inputCls} placeholder="Partita IVA" value={form.vat_number} onChange={set("vat_number")} data-testid="checkout-vat" />
              <input className={inputCls + " sm:col-span-2"} placeholder="Codice Fiscale" value={form.codice_fiscale} onChange={set("codice_fiscale")} data-testid="checkout-cf" />
            </div>
          </section>

          {/* Shipping method */}
          <section>
            <h2 className="eyebrow mb-4 text-[#C05A3E]">4 · Metodo di spedizione</h2>
            <div className="space-y-3">
              {options.map((o) => (
                <label
                  key={o.id}
                  data-testid={`shipping-option-${o.id}`}
                  className={`flex items-start gap-4 border p-4 cursor-pointer transition-colors ${
                    shipId === o.id ? "border-[#C05A3E] bg-[#FBF3EF]" : "border-[#E2DDD5] bg-white hover:border-[#C0B9AE]"
                  }`}
                >
                  <input type="radio" name="ship" checked={shipId === o.id} onChange={() => setShipId(o.id)} className="mt-1 accent-[#C05A3E]" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{o.name}</span>
                      <span className="font-semibold text-sm">
                        {shipId === o.id ? (shippingCost === 0 ? "Gratis" : eur(shippingCost)) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-[#78716C] mt-0.5">{o.description} · {o.eta}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-[#E2DDD5] p-6 sticky top-24">
            <h3 className="font-serif-display text-2xl mb-5">Riepilogo</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar mb-4">
              {items.map((i) => (
                <div key={i.product_id} className="flex gap-3 text-sm">
                  <div className="w-12 h-14 bg-[#F1EEE8] overflow-hidden shrink-0">
                    {i.image && <img src={i.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-[#78716C]">Qtà {i.quantity}</p>
                  </div>
                  <span className="font-medium">{eur(i.price * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#E2DDD5] pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#78716C]">Subtotale</span><span>{eur(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-[#78716C]">Spedizione</span><span>{shippingCost === 0 ? "Gratis" : eur(shippingCost)}</span></div>
              <div className="flex justify-between text-xs text-[#78716C]"><span>Peso</span><span>{weight.toFixed(1)} kg</span></div>
              <div className="flex justify-between text-lg font-semibold border-t border-[#E2DDD5] pt-3 mt-2">
                <span>Totale</span><span data-testid="checkout-total">{eur(total)}</span>
              </div>
              <p className="text-[0.7rem] text-[#78716C]">IVA inclusa</p>
            </div>
            <button
              type="submit"
              data-testid="checkout-place-order-btn"
              disabled={busy}
              className="w-full bg-[#C05A3E] text-white py-4 text-sm font-semibold tracking-wide hover:bg-[#A64B32] transition-colors mt-5 disabled:opacity-60"
            >
              {busy ? "Reindirizzamento…" : "Paga con Stripe"}
            </button>
            <div className="flex items-center gap-2 text-xs text-[#78716C] mt-4">
              <ShieldCheck className="w-4 h-4 text-[#6B7A6E]" /> Pagamento sicuro e crittografato
            </div>
            <div className="flex items-center gap-2 text-xs text-[#78716C] mt-1">
              <Truck className="w-4 h-4 text-[#6B7A6E]" /> Spedizione in tutta Italia
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
