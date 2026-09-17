import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

const PROFESSIONS = ["Architetto", "Interior Designer", "Impresa di costruzioni", "Rivenditore", "Altro professionista"];
const PROJECT_TYPES = ["Residenziale", "Commerciale", "Hospitality / Ristorazione", "Uffici", "Altro"];

const EMPTY_FORM = {
  name: "", email: "", phone: "", company: "",
  profession: PROFESSIONS[0], city: "", project_type: PROJECT_TYPES[0],
  estimated_sqm: "", budget_range: "", message: "",
};

export default function QuoteRequest() {
  usePageTitle("Preventivo Progetto");
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await api.post("/quotes/request", {
        ...form,
        estimated_sqm: form.estimated_sqm ? parseFloat(form.estimated_sqm) : null,
        product_ids: [],
      });
      setDone(data.request_number);
      toast.success("Richiesta di preventivo inviata!");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full bg-white border border-[#E2DDD5] px-3 py-2.5 focus:outline-none focus:border-[#C05A3E] text-sm";

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center" data-testid="quote-confirmation">
        <FileText className="w-10 h-10 mx-auto text-[#C05A3E] mb-4" />
        <h1 className="font-serif-display text-3xl mb-3">Richiesta inviata</h1>
        <p className="text-[#57534E]">
          Grazie! La richiesta di preventivo <strong>{done}</strong> è stata registrata. Il nostro
          team tecnico la valuterà e ti risponderà a breve con una proposta dedicata.
        </p>
        <Link to="/prodotti" className="inline-block mt-8 bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#3A3733] transition-colors">
          Torna al negozio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="quote-page">
      <Link to="/prodotti" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-8">
        <ArrowLeft className="w-4 h-4" /> Torna al negozio
      </Link>
      <p className="eyebrow text-[#C05A3E] mb-2">Per architetti e progettisti</p>
      <h1 className="font-serif-display text-4xl font-light mb-3">Preventivo Progetto</h1>
      <p className="text-[#57534E] mb-10 max-w-2xl">
        Richiedi un preventivo personalizzato per grandi forniture: condizioni dedicate, tempistiche
        di consegna e supporto tecnico per il tuo progetto.
      </p>

      <form onSubmit={submit} className="bg-white border border-[#E2DDD5] p-6 space-y-4" data-testid="quote-form">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input className={inputCls} placeholder="Nome e cognome" required value={form.name} onChange={setF("name")} data-testid="quote-name" />
          <input className={inputCls} type="email" placeholder="Email" required value={form.email} onChange={setF("email")} data-testid="quote-email" />
          <input className={inputCls} placeholder="Telefono" value={form.phone} onChange={setF("phone")} />
          <input className={inputCls} placeholder="Studio / Azienda" value={form.company} onChange={setF("company")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#78716C] mb-1.5 block">Profilo</label>
            <Select value={form.profession} onValueChange={(v) => setForm((f) => ({ ...f, profession: v }))}>
              <SelectTrigger data-testid="quote-profession" className="h-10 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {PROFESSIONS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-[#78716C] mb-1.5 block">Tipologia progetto</label>
            <Select value={form.project_type} onValueChange={(v) => setForm((f) => ({ ...f, project_type: v }))}>
              <SelectTrigger data-testid="quote-project-type" className="h-10 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {PROJECT_TYPES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input className={inputCls} placeholder="Città del progetto" value={form.city} onChange={setF("city")} />
          <input className={inputCls} type="number" min="0" step="0.1" placeholder="Superficie stimata (m²)" value={form.estimated_sqm} onChange={setF("estimated_sqm")} data-testid="quote-sqm" />
          <input className={inputCls} placeholder="Budget indicativo (opz.)" value={form.budget_range} onChange={setF("budget_range")} />
        </div>

        <textarea className={inputCls} rows={5} placeholder="Descrivi il progetto: prodotti di interesse, tempistiche, quantità stimate…"
          required value={form.message} onChange={setF("message")} data-testid="quote-message" />

        <button type="submit" disabled={sending} data-testid="quote-submit"
          className="w-full bg-[#C05A3E] text-white py-3.5 text-sm font-semibold hover:bg-[#A64B32] transition-colors disabled:opacity-60">
          {sending ? "Invio in corso…" : "Richiedi preventivo personalizzato"}
        </button>
      </form>
    </div>
  );
}
