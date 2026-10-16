import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { COMPANY } from "@/lib/company";

// Recesso online (Direttiva UE 2023/2673): "Recedere dal contratto qui" → dati →
// "Conferma il recesso" → ricevuta via email con contenuto, data e ora.
const inputCls = "w-full bg-white border border-[#E2DDD5] px-3 py-2.5 focus:outline-none focus:border-[#C05A3E] text-sm";
const btnCls = "bg-[#C05A3E] text-white px-6 py-3 text-sm font-medium hover:bg-[#A64B32] transition-colors disabled:opacity-60";

const Steps = ({ step }) => (
  <ol className="flex gap-2 text-xs mb-8" aria-label="Passaggi">
    {["Dati dell'ordine", "Prodotti", "Conferma"].map((t, i) => (
      <li key={t} aria-current={step === i ? "step" : undefined}
        className={`flex-1 border-t-2 pt-2 ${step >= i ? "border-[#C05A3E] text-[#1C1917]" : "border-[#E2DDD5] text-[#78716C]"}`}>
        {i + 1}. {t}
      </li>
    ))}
  </ol>
);

export default function Withdraw() {
  usePageTitle("Recedere dal contratto");
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [orderNumber, setOrderNumber] = useState(params.get("ordine") || "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [sel, setSel] = useState({}); // index -> quantità (0 = non incluso)
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/withdrawals/lookup", { order_number: orderNumber.trim(), email: email.trim() });
      setOrder(data);
      setSel(Object.fromEntries(data.items.map((it) => [it.index, it.quantity])));
      setStep(1);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "Errore, riprova.");
    } finally { setBusy(false); }
  };

  const chosen = order ? order.items.filter((it) => (sel[it.index] || 0) > 0) : [];

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/withdrawals", {
        order_number: order.order_number, email: email.trim(), note: note.trim(),
        items: chosen.map((it) => ({ index: it.index, quantity: sel[it.index] })),
      });
      setDone(data);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "Errore, riprova.");
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20" data-testid="withdraw-done">
        <CheckCircle2 className="w-10 h-10 text-[#3F7A4F] mb-4" />
        <h1 className="font-serif-display text-3xl mb-3">Recesso ricevuto</h1>
        <p className="text-[#57534E] mb-6">
          Abbiamo ricevuto la tua richiesta di recesso <strong>{done.request_number}</strong> per l&rsquo;ordine{" "}
          <strong>{done.order_number}</strong> il <strong>{done.received_at_local}</strong> (ora italiana).
        </p>
        <div className="border border-[#E2DDD5] bg-white p-5 mb-6 text-sm text-[#57534E]">
          <ul className="list-disc pl-5 mb-3">
            {done.items.map((it, i) => (<li key={i}>{it.name} &times; {it.quantity}</li>))}
          </ul>
          {done.receipt_sent ? (
            <p>La ricevuta con questi dati è stata inviata a <strong>{done.email}</strong>. Conservala.</p>
          ) : (
            <p className="text-[#A64B32]">La richiesta è registrata, ma non siamo riusciti a inviare la ricevuta via email: ti scriveremo noi. Puoi anche salvare questa pagina.</p>
          )}
        </div>
        <p className="text-sm text-[#57534E]">
          Ti contatteremo per il reso. Devi restituire i beni entro 14 giorni, integri e nell&rsquo;imballo originale; la spedizione del reso è a carico tuo (a carico nostro solo se il prodotto è arrivato danneggiato o non conforme).
          Dettagli nella pagina <Link to="/recesso" className="text-[#C05A3E] underline">Diritto di recesso</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16" data-testid="withdraw-page">
      <Link to="/recesso" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-6">
        <ArrowLeft className="w-4 h-4" /> Diritto di recesso
      </Link>
      <h1 className="font-serif-display text-3xl mb-3">Recedere dal contratto qui</h1>
      <p className="text-sm text-[#57534E] mb-8">
        Se sei un consumatore, puoi recedere entro 14 giorni dal ricevimento dei beni, senza indicare il motivo.
        Compila i dati e conferma: ti mandiamo subito una ricevuta via email con il contenuto della richiesta, la data e l&rsquo;ora.
      </p>
      <Steps step={step} />

      {error && <p role="alert" className="mb-6 bg-[#FBEAE5] text-[#A64B32] text-sm px-4 py-3" data-testid="withdraw-error">{error}</p>}

      {step === 0 && (
        <form onSubmit={lookup} className="space-y-4" data-testid="withdraw-step-order">
          <div>
            <label htmlFor="w-order" className="block text-xs font-medium text-[#57534E] mb-1.5">Numero d&rsquo;ordine</label>
            <input id="w-order" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Es. CI-261016-AB12CD" className={inputCls} autoComplete="off" data-testid="withdraw-order-number" />
            <p className="text-xs text-[#78716C] mt-1">
              Lo trovi nell&rsquo;email di conferma dell&rsquo;ordine (inizia con CI-). Il recesso vale per gli ordini di acquisto,
              non per le richieste di campioni, che sono gratuite.
            </p>
          </div>
          <div>
            <label htmlFor="w-email" className="block text-xs font-medium text-[#57534E] mb-1.5">Email usata per l&rsquo;ordine</label>
            <input id="w-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls} autoComplete="email" data-testid="withdraw-email" />
          </div>
          <button type="submit" disabled={busy} className={btnCls} data-testid="withdraw-lookup-btn">
            {busy ? "Verifica…" : "Continua"}
          </button>
        </form>
      )}

      {step === 1 && order && (
        <div data-testid="withdraw-step-items">
          <p className="text-sm text-[#57534E] mb-4">
            Ordine <strong>{order.order_number}</strong> del {new Date(order.created_at).toLocaleDateString("it-IT")} — {order.customer_name}.
            Scegli i prodotti per cui vuoi recedere.
          </p>
          {order.is_business && (
            <p className="mb-4 bg-[#F3EAE0] text-[#8C6A4A] text-sm px-4 py-3">
              L&rsquo;ordine riporta dati di fatturazione aziendali: il diritto di recesso spetta solo ai consumatori.
              Puoi comunque inviare la richiesta e la valuteremo.
            </p>
          )}
          {order.previous_requests?.length > 0 && (
            <p className="mb-4 text-sm text-[#78716C]">
              Per questo ordine hai già inviato: {order.previous_requests.map((r) => r.request_number).join(", ")}.
            </p>
          )}
          <div className="border border-[#E2DDD5] bg-white divide-y divide-[#E2DDD5] mb-4">
            {order.items.map((it) => {
              const on = (sel[it.index] || 0) > 0;
              return (
                <div key={it.index} className="flex items-center gap-3 p-3">
                  <input type="checkbox" id={`w-it-${it.index}`} checked={on} className="w-4 h-4 accent-[#C05A3E]"
                    onChange={(e) => setSel((s) => ({ ...s, [it.index]: e.target.checked ? it.quantity : 0 }))} />
                  <label htmlFor={`w-it-${it.index}`} className="flex-1 text-sm text-[#1C1917]">{it.name}</label>
                  <label className="text-xs text-[#78716C] flex items-center gap-2">
                    Quantità
                    <select value={sel[it.index] || 0} aria-label={`Quantità ${it.name}`}
                      onChange={(e) => setSel((s) => ({ ...s, [it.index]: parseInt(e.target.value, 10) }))}
                      className="border border-[#E2DDD5] bg-white px-2 py-1 text-sm text-[#1C1917]">
                      {Array.from({ length: it.quantity + 1 }, (_, n) => (<option key={n} value={n}>{n}</option>))}
                    </select>
                    <span>su {it.quantity}</span>
                  </label>
                </div>
              );
            })}
          </div>
          <label htmlFor="w-note" className="block text-xs font-medium text-[#57534E] mb-1.5">Nota (facoltativa)</label>
          <textarea id="w-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
            className={inputCls + " mb-6"} placeholder="Non serve indicare il motivo." />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="border border-[#E2DDD5] px-6 py-3 text-sm">Indietro</button>
            <button type="button" disabled={!chosen.length} onClick={() => { setError(""); setStep(2); }} className={btnCls} data-testid="withdraw-items-next">
              Continua
            </button>
          </div>
        </div>
      )}

      {step === 2 && order && (
        <div data-testid="withdraw-step-confirm">
          <h2 className="text-lg font-medium text-[#1C1917] mb-3">Controlla e conferma</h2>
          <div className="border border-[#E2DDD5] bg-white p-5 text-sm text-[#57534E] mb-4 space-y-1">
            <p><span className="text-[#78716C]">Nome:</span> {order.customer_name}</p>
            <p><span className="text-[#78716C]">Email per la ricevuta:</span> {email}</p>
            <p><span className="text-[#78716C]">Ordine:</span> {order.order_number} del {new Date(order.created_at).toLocaleDateString("it-IT")}</p>
            <p className="text-[#78716C] pt-2">Prodotti per cui recedi:</p>
            <ul className="list-disc pl-5">
              {chosen.map((it) => (<li key={it.index}>{it.name} &times; {sel[it.index]}</li>))}
            </ul>
            {note.trim() && <p className="pt-2"><span className="text-[#78716C]">Nota:</span> {note.trim()}</p>}
          </div>
          <p className="text-sm text-[#57534E] mb-6">
            Premendo «Conferma il recesso» dichiari di recedere dal contratto di vendita per i prodotti indicati.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="border border-[#E2DDD5] px-6 py-3 text-sm">Modifica</button>
            <button type="button" disabled={busy} onClick={confirm} className={btnCls} data-testid="withdraw-confirm-btn">
              {busy ? "Invio…" : "Conferma il recesso"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[#78716C] mt-10">
        Problemi con il modulo? Puoi recedere anche scrivendo a <a href={`mailto:${COMPANY.email}`} className="underline">{COMPANY.email}</a> o alla PEC {COMPANY.pec}.
      </p>
    </div>
  );
}
