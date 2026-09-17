import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { X, ArrowLeft, Beaker } from "lucide-react";
import { useSamples, MAX_SAMPLES } from "@/context/SamplesContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const EMPTY_FORM = {
  name: "", email: "", phone: "",
  line1: "", city: "", postal_code: "", province: "",
  note: "",
};

export default function Samples() {
  usePageTitle("Campioni gratuiti");
  const { items, removeSample, clear } = useSamples();
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

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
      });
      setDone(data.request_number);
      clear();
      toast.success("Richiesta campioni inviata!");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full bg-white border border-[#E2DDD5] px-3 py-2.5 focus:outline-none focus:border-[#C05A3E] text-sm";

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center" data-testid="samples-confirmation">
        <Beaker className="w-10 h-10 mx-auto text-[#C05A3E] mb-4" />
        <h1 className="font-serif-display text-3xl mb-3">Richiesta ricevuta</h1>
        <p className="text-[#57534E]">
          Grazie! La tua richiesta campioni <strong>{done}</strong> è stata registrata. Ti abbiamo
          inviato una email di conferma e ti contatteremo appena i campioni saranno spediti.
        </p>
        <Link to="/prodotti" className="inline-block mt-8 bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#3A3733] transition-colors">
          Torna al negozio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="samples-page">
      <Link to="/prodotti" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-8">
        <ArrowLeft className="w-4 h-4" /> Torna al negozio
      </Link>
      <p className="eyebrow text-[#C05A3E] mb-2">Prova prima di acquistare</p>
      <h1 className="font-serif-display text-4xl font-light mb-3">Richiesta Campioni Gratuiti</h1>
      <p className="text-[#57534E] mb-10 max-w-2xl">
        Seleziona fino a {MAX_SAMPLES} prodotti dal catalogo per ricevere a casa un campione gratuito
        prima dell'acquisto. Nessun costo, nessun impegno.
      </p>

      {items.length === 0 ? (
        <div className="bg-white border border-[#E2DDD5] p-10 text-center text-[#78716C]" data-testid="samples-empty">
          Non hai ancora selezionato campioni. Vai su un prodotto e clicca "Richiedi campione gratuito".
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
            <button type="submit" disabled={sending} data-testid="samples-submit"
              className="w-full bg-[#C05A3E] text-white py-3.5 text-sm font-semibold hover:bg-[#A64B32] transition-colors disabled:opacity-60">
              {sending ? "Invio in corso…" : "Invia richiesta campioni gratuiti"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
