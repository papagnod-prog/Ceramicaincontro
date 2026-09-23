import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { X, ArrowLeft, Landmark, CreditCard } from "lucide-react";
import { useSamples, MAX_SAMPLES } from "@/context/SamplesContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const SAMPLE_SHIPPING_FEE = 6;

const EMPTY_FORM = {
  name: "", email: "", phone: "",
  line1: "", city: "", postal_code: "", province: "",
  note: "",
};

export default function Samples() {
  usePageTitle("Campioni");
  const { items, removeSample, clear } = useSamples();
  const [form, setForm] = useState(EMPTY_FORM);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [sending, setSending] = useState(false);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSending(true);
    try {
      const { data } = await api.post("/samples/request", {
        items: items.map((i) => ({ product_id: i.product_id })),
        customer: { name: form.name, email: form.email, phone: form.phone },
        shipping_address: {
          line1: form.line1, city: form.city, postal_code: form.postal_code,
          province: form.province, country: "IT",
        },
        note: form.note,
        payment_method: paymentMethod,
        origin_url: window.location.origin + "/store",
      });
      clear();
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setSending(false);
    }
  };

  const inputCls = "w-full bg-white border border-[#E2DDD5] px-3 py-2.5 focus:outline-none focus:border-[#C05A3E] text-sm";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="samples-page">
      <Link to="/prodotti" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-8">
        <ArrowLeft className="w-4 h-4" /> Torna al negozio
      </Link>
      <p className="eyebrow text-[#C05A3E] mb-2">Prova prima di acquistare</p>
      <h1 className="font-serif-display text-4xl font-light mb-3">Richiesta Campioni</h1>
      <p className="text-[#57534E] mb-10 max-w-2xl">
        Seleziona fino a {MAX_SAMPLES} prodotti dal catalogo per ricevere a casa un campione prima
        dell'acquisto. I campioni sono gratuiti: si paga solo un contributo spese di spedizione
        forfettario di &euro; {SAMPLE_SHIPPING_FEE.toFixed(2)}.
      </p>

      {items.length === 0 ? (
        <div className="bg-white border border-[#E2DDD5] p-10 text-center text-[#78716C]" data-testid="samples-empty">
          Non hai ancora selezionato campioni. Vai su un prodotto e clicca "Richiedi campione".
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10">
          <div>
            <h3 className="eyebrow mb-4">Campioni selezionati ({items.length}/{MAX_SAMPLES})</h3>
            <div className="space-y-3" data-testid="samples-list">
              {items.map((i) => (
                <div key={i.product_id} className="flex items-center gap-3 bg-white border border-[#E2DDD5] p-3">
                  <div className="w-14 h-14 bg-[#F1EEE8] shrink-0 overflow-hidden">
                    {i.image && <img src={i.image} alt={i.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[#C05A3E] eyebrow">{i.collection}</p>
                    <p className="font-medium text-sm">{i.name}</p>
                  </div>
                  <button onClick={() => removeSample(i.product_id)} data-testid={`remove-sample-${i.product_id}`}
                    className="p-2 hover:bg-[#F1EEE8] rounded-full text-[#78716C]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-sm bg-white border border-[#E2DDD5] p-3">
              <span className="text-[#78716C]">Contributo spedizione</span>
              <span className="font-medium">&euro; {SAMPLE_SHIPPING_FEE.toFixed(2)}</span>
            </div>
          </div>

          <form onSubmit={submit} className="bg-white border border-[#E2DDD5] p-6 space-y-3" data-testid="samples-form">
            <h3 className="eyebrow mb-2">I tuoi dati per la spedizione</h3>
            <input className={inputCls} placeholder="Nome e cognome" required value={form.name} onChange={setF("name")} data-testid="samples-name" />
            <input className={inputCls} type="email" placeholder="Email" required value={form.email} onChange={setF("email")} data-testid="samples-email" />
            <input className={inputCls} placeholder="Telefono" value={form.phone} onChange={setF("phone")} />
            <input className={inputCls} placeholder="Indirizzo" required value={form.line1} onChange={setF("line1")} />
            <div className="grid grid-cols-3 gap-3">
              <input className={inputCls} placeholder="Città" required value={form.city} onChange={setF("city")} />
              <input className={inputCls} placeholder="CAP" required value={form.postal_code} onChange={setF("postal_code")} />
              <input className={inputCls} placeholder="Prov." value={form.province} onChange={setF("province")} />
            </div>
            <textarea className={inputCls} rows={3} placeholder="Note (opzionale)" value={form.note} onChange={setF("note")} />

            <div className="pt-2 space-y-2">
              <p className="text-xs text-[#78716C] mb-1">Metodo di pagamento del contributo spese (&euro; {SAMPLE_SHIPPING_FEE.toFixed(2)})</p>
              <label
                data-testid="sample-payment-card"
                className={`flex items-center gap-3 border p-3 cursor-pointer transition-colors ${
                  paymentMethod === "card" ? "border-[#C05A3E] bg-[#FBF3EF]" : "border-[#E2DDD5] bg-white hover:border-[#C0B9AE]"
                }`}
              >
                <input type="radio" name="sample-payment" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} className="accent-[#C05A3E]" />
                <CreditCard className="w-4 h-4 text-[#78716C]" />
                <span className="text-sm font-medium">Carta</span>
              </label>
              <label
                data-testid="sample-payment-bank_transfer"
                className={`flex items-center gap-3 border p-3 cursor-pointer transition-colors ${
                  paymentMethod === "bank_transfer" ? "border-[#C05A3E] bg-[#FBF3EF]" : "border-[#E2DDD5] bg-white hover:border-[#C0B9AE]"
                }`}
              >
                <input type="radio" name="sample-payment" checked={paymentMethod === "bank_transfer"} onChange={() => setPaymentMethod("bank_transfer")} className="accent-[#C05A3E]" />
                <Landmark className="w-4 h-4 text-[#78716C]" />
                <span className="text-sm font-medium">Bonifico bancario</span>
              </label>
            </div>

            <button type="submit" disabled={sending} data-testid="samples-submit"
              className="w-full bg-[#C05A3E] text-white py-3.5 text-sm font-semibold hover:bg-[#A64B32] transition-colors disabled:opacity-60">
              {sending ? "Attendere…" : paymentMethod === "card" ? "Procedi al pagamento" : "Invia richiesta campioni"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
