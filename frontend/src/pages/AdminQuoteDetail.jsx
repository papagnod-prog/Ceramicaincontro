import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

const QUOTE_STATUS_OPTS = ["new", "in_review", "quoted", "won", "lost"];
const QUOTE_STATUS_LABEL = {
  new: "Nuovo", in_review: "In valutazione", quoted: "Preventivo inviato",
  won: "Vinto", lost: "Perso",
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" }) : "—");

function Field({ label, children, testid }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#78716C] mb-1">{label}</dt>
      <dd className="text-sm text-[#1C1917] break-words" data-testid={testid}>{children || "—"}</dd>
    </div>
  );
}

/** Dettaglio di una richiesta di preventivo: tutti i dati inviati dal cliente + stato, importo e nota interna. */
export default function AdminQuoteDetail() {
  usePageTitle("Dettaglio preventivo");
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [quote, setQuote] = useState(null);
  const [form, setForm] = useState({ status: "new", quoted_amount: "", admin_note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login");
  }, [loading, user, navigate]);

  const load = () => {
    api.get(`/admin/quotes/${quoteId}`)
      .then(({ data }) => {
        setQuote(data);
        setForm({ status: data.status || "new", quoted_amount: data.quoted_amount ?? "", admin_note: data.admin_note || "" });
      })
      .catch(() => setQuote(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.role === "admin") load(); }, [user, quoteId]);

  const save = async () => {
    setBusy(true);
    try {
      const amount = String(form.quoted_amount).trim();
      await api.put(`/admin/quotes/${quoteId}/status`, {
        status: form.status,
        quoted_amount: amount ? parseFloat(amount.replace(",", ".")) : null,
        admin_note: form.admin_note || "",
      });
      toast.success("Preventivo salvato");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user || user.role !== "admin") return null;
  if (quote === null) return <div className="max-w-4xl mx-auto px-4 py-16 text-[#78716C]">Caricamento…</div>;
  if (quote === false) return <div className="max-w-4xl mx-auto px-4 py-16 text-[#78716C]">Richiesta non trovata.</div>;

  const products = quote.products || [];
  const consent = quote.consents || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-10" data-testid="admin-quote-detail-page">
      <Link to="/admin?tab=quotes" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-6">
        <ArrowLeft className="w-4 h-4" /> Torna ai preventivi
      </Link>

      <div className="border border-[#E2DDD5] bg-white p-8">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6 border-b border-[#E2DDD5] pb-4">
          <div>
            <h1 className="text-2xl font-serif text-[#1C1917]" data-testid="quote-detail-number">Richiesta {quote.request_number}</h1>
            <p className="text-sm text-[#78716C]">Ricevuta il {fmtDate(quote.created_at)}</p>
          </div>
          <div className="text-sm font-medium text-right">{QUOTE_STATUS_LABEL[quote.status] || quote.status}</div>
        </div>

        <h2 className="text-xs uppercase tracking-wide text-[#C05A3E] mb-3 font-medium">Chi ha scritto</h2>
        <dl className="grid sm:grid-cols-2 gap-5 mb-8">
          <Field label="Nome" testid="quote-detail-name">{quote.name}</Field>
          <Field label="Azienda / studio" testid="quote-detail-company">{quote.company}</Field>
          <Field label="Email" testid="quote-detail-email">
            {quote.email && <a href={`mailto:${quote.email}`} className="text-[#C05A3E] underline">{quote.email}</a>}
          </Field>
          <Field label="Telefono" testid="quote-detail-phone">
            {quote.phone && <a href={`tel:${quote.phone.replace(/\s+/g, "")}`} className="text-[#C05A3E] underline">{quote.phone}</a>}
          </Field>
          <Field label="Profilo" testid="quote-detail-profession">{quote.profession}</Field>
          <Field label="Città" testid="quote-detail-city">{quote.city}</Field>
        </dl>

        <h2 className="text-xs uppercase tracking-wide text-[#C05A3E] mb-3 font-medium">Progetto</h2>
        <dl className="grid sm:grid-cols-2 gap-5 mb-5">
          <Field label="Tipo di progetto" testid="quote-detail-project">{quote.project_type}</Field>
          <Field label="Superficie stimata" testid="quote-detail-sqm">{quote.estimated_sqm ? `${quote.estimated_sqm} m²` : ""}</Field>
          <Field label="Budget indicativo" testid="quote-detail-budget">{quote.budget_range}</Field>
          <Field label="Prodotti di interesse" testid="quote-detail-products">
            {products.length > 0 && products.map((p) => `${p.name}${p.collection ? ` (${p.collection})` : ""}`).join(", ")}
          </Field>
        </dl>
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wide text-[#78716C] mb-1">Messaggio</div>
          <p className="text-sm text-[#1C1917] whitespace-pre-wrap bg-[#F8F6F2] border border-[#E2DDD5] p-4" data-testid="quote-detail-message">
            {quote.message || "Nessun messaggio."}
          </p>
        </div>

        <p className="text-xs text-[#78716C]" data-testid="quote-detail-consent">
          Informativa privacy accettata{consent.accepted_at ? ` il ${fmtDate(consent.accepted_at)}` : ""}
          {consent.terms_version ? ` · versione testi ${consent.terms_version}` : ""}
        </p>
      </div>

      <div className="mt-6 border border-[#E2DDD5] bg-white p-6" data-testid="quote-detail-edit">
        <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-4 font-medium">Gestione preventivo</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#78716C] block mb-1">Stato</label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger aria-label="Stato preventivo" data-testid="quote-detail-status" className="h-10 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {QUOTE_STATUS_OPTS.map((st) => (<SelectItem key={st} value={st}>{QUOTE_STATUS_LABEL[st]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="quote-amount" className="text-xs text-[#78716C] block mb-1">Importo preventivo (€)</label>
            <input id="quote-amount" type="number" step="0.01" placeholder="0.00" data-testid="quote-detail-amount"
              value={form.quoted_amount} onChange={(e) => setForm((f) => ({ ...f, quoted_amount: e.target.value }))}
              className="w-full h-10 border border-[#E2DDD5] px-3 text-sm focus:outline-none focus:border-[#C05A3E]" />
          </div>
        </div>
        <label htmlFor="quote-note" className="text-xs text-[#78716C] block mb-1">Nota interna (non la vede il cliente)</label>
        <textarea id="quote-note" rows={4} data-testid="quote-detail-note"
          value={form.admin_note} onChange={(e) => setForm((f) => ({ ...f, admin_note: e.target.value }))}
          className="w-full border border-[#E2DDD5] px-3 py-2 text-sm focus:outline-none focus:border-[#C05A3E] mb-4" />
        <button type="button" onClick={save} disabled={busy} data-testid="quote-detail-save"
          className="bg-[#1C1917] text-white text-sm px-5 py-2.5 hover:bg-[#C05A3E] disabled:opacity-60">
          {busy ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}
