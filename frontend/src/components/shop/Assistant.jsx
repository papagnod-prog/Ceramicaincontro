import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

const MAX_SENT = 6;
const QUICK = [
  "Dov'è il mio ordine?",
  "Quante confezioni mi servono?",
  "Quanto costa la spedizione?",
  "Come funziona il recesso?",
  "Vorrei dei campioni",
];
const WELCOME = "Ciao, sono Glaze, l'assistente automatico di Ceramica Incontro. Posso aiutarti con prodotti, spedizioni, ordini e campioni.";

export function Assistant() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(null); // 'order' | 'support' | null
  const [orderToken, setOrderToken] = useState(null);
  const [card, setCard] = useState(null);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    api.get("/assistant/config").then(({ data }) => setEnabled(!!data.enabled)).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [msgs, panel, card, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { setOpen(false); setTimeout(() => btnRef.current?.focus(), 0); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  if (!enabled) return null;

  const close = () => { setOpen(false); setTimeout(() => btnRef.current?.focus(), 0); };
  const userCount = msgs.filter((m) => m.role === "user").length;
  const limitReached = userCount >= MAX_SENT;

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || busy || limitReached) return;
    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next); setInput(""); setBusy(true); setErr("");
    try {
      const history = next.filter((m) => !m.local).slice(-8).map(({ role, content }) => ({ role, content }));
      const { data } = await api.post("/assistant/chat", { messages: history, order_token: orderToken });
      setMsgs((m) => [...m, { role: "assistant", content: data.text }]);
      if (data.action === "order_form") setPanel("order");
      else if (data.action === "support") setPanel("support");
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Scusa, c'è un problema tecnico. Puoi lasciare una richiesta a una persona qui sotto o scrivere a info@ceramicaincontro.it." }]);
      setPanel("support");
    } finally { setBusy(false); }
  };

  const OrderForm = () => {
    const [n, setN] = useState(""); const [em, setEm] = useState(""); const [ld, setLd] = useState(false); const [e, setE] = useState("");
    const go = async (ev) => {
      ev.preventDefault(); setLd(true); setE("");
      try {
        const { data } = await api.post("/assistant/order", { order: n, email: em });
        setOrderToken(data.order_token); setCard(data.card); setPanel(null);
        setMsgs((m) => [...m, { role: "assistant", content: `Ho trovato l'ordine ${data.card.numero}. Cosa vuoi sapere?` }]);
      } catch (x) {
        setE(x?.response?.data?.detail && typeof x.response.data.detail === "string" ? x.response.data.detail : "Non riesco a verificare i dati. Riprova.");
      } finally { setLd(false); }
    };
    return (
      <form onSubmit={go} className="bg-white border border-[#E7E5E4] p-3 space-y-2" aria-label="Verifica ordine">
        <p className="text-xs text-[#57534E]">Inserisci numero ordine ed email usata per l'acquisto.</p>
        <label className="block text-xs">Numero ordine
          <input required value={n} onChange={(x) => setN(x.target.value)} className="mt-1 w-full border border-[#A8A29E] px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs">Email
          <input required type="email" value={em} onChange={(x) => setEm(x.target.value)} className="mt-1 w-full border border-[#A8A29E] px-2 py-1.5 text-sm" /></label>
        {e && <p role="alert" className="text-xs text-[#B91C1C]">{e}</p>}
        <button disabled={ld} className="bg-[#A64B32] text-white text-sm px-3 py-1.5 disabled:opacity-60">{ld ? "Verifico…" : "Verifica"}</button>
      </form>
    );
  };

  const SupportForm = () => {
    const [name, setName] = useState(""); const [em, setEm] = useState(""); const [m, setM] = useState("");
    const [ok, setOk] = useState(false); const [ld, setLd] = useState(false); const [e, setE] = useState("");
    const go = async (ev) => {
      ev.preventDefault(); setLd(true); setE("");
      try {
        const transcript = msgs.filter((x) => !x.local).slice(-12).map(({ role, content }) => ({ role, content }));
        const { data } = await api.post("/assistant/support", { name, email: em, message: m, transcript, accept_privacy: ok });
        setSent(data.request_number); setPanel(null);
        setMsgs((x) => [...x, { role: "assistant", content: `Richiesta inviata (${data.request_number}). Una persona ti risponderà via email in orario di assistenza.` }]);
      } catch (x) {
        const d = x?.response?.data?.detail;
        setE(typeof d === "string" ? d : "Invio non riuscito. Scrivi a info@ceramicaincontro.it.");
      } finally { setLd(false); }
    };
    return (
      <form onSubmit={go} className="bg-white border border-[#E7E5E4] p-3 space-y-2" aria-label="Richiesta di assistenza">
        <p className="text-xs text-[#57534E]">Lascia i tuoi dati: una persona ti risponde via email. Allegheremo il riepilogo della chat.</p>
        <label className="block text-xs">Nome
          <input required value={name} onChange={(x) => setName(x.target.value)} className="mt-1 w-full border border-[#A8A29E] px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs">Email
          <input required type="email" value={em} onChange={(x) => setEm(x.target.value)} className="mt-1 w-full border border-[#A8A29E] px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs">Messaggio (facoltativo)
          <textarea maxLength={1000} rows={2} value={m} onChange={(x) => setM(x.target.value)} className="mt-1 w-full border border-[#A8A29E] px-2 py-1.5 text-sm" /></label>
        <label className="flex gap-2 text-xs items-start">
          <input type="checkbox" checked={ok} onChange={(x) => setOk(x.target.checked)} className="mt-0.5" />
          <span>Ho letto l'<Link to="/privacy" className="underline text-[#A64B32]">informativa privacy</Link>.</span></label>
        {e && <p role="alert" className="text-xs text-[#B91C1C]">{e}</p>}
        <button disabled={ld || !ok} className="bg-[#A64B32] text-white text-sm px-3 py-1.5 disabled:opacity-60">{ld ? "Invio…" : "Invia richiesta"}</button>
      </form>
    );
  };

  return (
    <>
      {!open && (
        <button ref={btnRef} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="assistant-open"
          className="fixed bottom-4 right-4 z-40 bg-[#A64B32] text-white px-4 py-3 text-sm font-medium shadow-lg hover:bg-[#8F3F29]">
          Glaze · assistente
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Glaze, assistente virtuale" data-testid="assistant-panel"
          className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-[380px] h-[80vh] sm:h-[560px] max-h-[100vh] bg-[#F8F6F2] border border-[#D6D3D1] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between bg-[#1C1917] text-white px-4 py-2.5">
            <span className="font-medium text-sm">Glaze · assistente</span>
            <button onClick={close} aria-label="Chiudi assistente" className="px-2 text-lg leading-none">×</button>
          </div>
          <p className="text-[11px] bg-[#E7E5E4] text-[#292524] px-4 py-1.5">
            Sei in chat con un'IA, non con una persona. Non scrivere dati di carte o IBAN. <Link to="/assistente-ia" className="underline">Come funziona</Link>
          </p>
          <div className="flex-1 overflow-y-auto p-3 space-y-2" role="log" aria-live="polite" aria-relevant="additions">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <p className={`text-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-[#A64B32] text-white" : "bg-white border border-[#E7E5E4] text-[#1C1917]"}`}>{m.content}</p>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="text-xs border border-[#A64B32] text-[#8F3F29] px-2 py-1 hover:bg-white">{q}</button>
                ))}
              </div>
            )}
            {card && (
              <dl className="bg-white border border-[#E7E5E4] p-3 text-xs grid grid-cols-2 gap-x-2 gap-y-1" aria-label="Riepilogo ordine">
                <dt className="text-[#57534E]">Ordine</dt><dd>{card.numero}</dd>
                <dt className="text-[#57534E]">Stato</dt><dd>{card.stato}</dd>
                <dt className="text-[#57534E]">Pagamento</dt><dd>{card.pagamento}</dd>
                {card.tracking && <><dt className="text-[#57534E]">Tracking</dt><dd>{card.tracking}</dd></>}
              </dl>
            )}
            {busy && <p className="text-xs text-[#57534E]">Glaze sta scrivendo…</p>}
            {panel === "order" && <OrderForm />}
            {panel === "support" && <SupportForm />}
            {!panel && !sent && (
              <div className="flex gap-3 text-xs">
                <button onClick={() => setPanel("order")} className="underline text-[#8F3F29]">Stato ordine</button>
                <button onClick={() => setPanel("support")} className="underline text-[#8F3F29]">Parla con una persona</button>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[#D6D3D1] p-2 flex gap-2 bg-white">
            <label className="sr-only" htmlFor="glaze-input">Scrivi un messaggio</label>
            <input id="glaze-input" ref={inputRef} value={input} maxLength={500} onChange={(e) => setInput(e.target.value)}
              disabled={limitReached} placeholder={limitReached ? "Limite raggiunto: chiedi a una persona" : "Scrivi qui…"}
              className="flex-1 border border-[#A8A29E] px-2 py-1.5 text-sm" />
            <button disabled={busy || limitReached || !input.trim()} className="bg-[#A64B32] text-white text-sm px-3 disabled:opacity-60">Invia</button>
          </form>
        </div>
      )}
    </>
  );
}
