import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "@/lib/api";

const MAX_SENT = 6;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_SIDE = 1024;
const PHOTO_MAX_CHARS = 1_000_000; // ~750 KB dopo la riduzione
const PHOTO_DEFAULT_Q = "Quale battiscopa si abbina a questa foto?";

// Riduce la foto nel browser (lato lungo 1024 px, JPEG) prima dell'invio.
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * k)); const h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = 0.85; let out = c.toDataURL("image/jpeg", q);
      while (out.length > PHOTO_MAX_CHARS && q > 0.4) { q -= 0.15; out = c.toDataURL("image/jpeg", q); }
      if (out.length > PHOTO_MAX_CHARS) reject(new Error("big")); else resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("read")); };
    img.src = url;
  });
}
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
  const [chatId, setChatId] = useState(null);
  const [photo, setPhoto] = useState(null); // data URL pronta per l'invio
  const [photoErr, setPhotoErr] = useState("");
  const location = useLocation();
  const fileRef = useRef(null);
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

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setPhotoErr("");
    if (!f) return;
    if (!PHOTO_TYPES.includes(f.type)) { setPhotoErr("Formato non supportato: usa una foto JPG, PNG o WEBP."); return; }
    if (f.size > 25 * 1024 * 1024) { setPhotoErr("La foto è troppo grande (massimo 25 MB)."); return; }
    try { setPhoto(await shrinkPhoto(f)); inputRef.current?.focus(); }
    catch { setPhotoErr("Non riesco a leggere questa foto. Prova con un'altra."); }
  };

  const send = async (text) => {
    const img = text === undefined ? photo : null;
    const t = ((text ?? input).trim()) || (img ? PHOTO_DEFAULT_Q : "");
    if (!t || busy || limitReached) return;
    const next = [...msgs, img ? { role: "user", content: t, image: img } : { role: "user", content: t }];
    setMsgs(next); setInput(""); setBusy(true); setErr(""); setPhoto(null); setPhotoErr("");
    try {
      const history = next.filter((m) => !m.local).slice(-8).map(({ role, content }) => ({ role, content }));
      const payload = { messages: history, order_token: orderToken, chat_id: chatId, page: location.pathname };
      if (img) payload.image = img;
      const { data } = await api.post("/assistant/chat", payload);
      if (data.chat_id) setChatId(data.chat_id);
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
        const { data } = await api.post("/assistant/support", { name, email: em, message: m, transcript, accept_privacy: ok, chat_id: chatId });
        setSent(data.request_number); setPanel(null);
        setMsgs((x) => [...x, { role: "assistant", content: `Richiesta inviata (${data.request_number}). Una persona ti risponderà via email in orario di assistenza.` }]);
      } catch (x) {
        const d = x?.response?.data?.detail;
        setE(typeof d === "string" ? d : "Invio non riuscito. Scrivi a info@ceramicaincontro.it.");
      } finally { setLd(false); }
    };
    return (
      <form onSubmit={go} className="bg-white border border-[#E7E5E4] p-3 space-y-2" aria-label="Richiesta di assistenza">
        <p className="text-xs text-[#57534E]">Lascia i tuoi dati: una persona ti risponde via email. Allegheremo il riepilogo della chat{msgs.some((x) => x.image) ? " e le foto inviate" : ""}.</p>
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
            Sei in chat con un'IA, non con una persona. La conversazione e le eventuali foto vengono salvate per 6 mesi per migliorare il servizio. Non scrivere dati di carte o IBAN. <Link to="/assistente-ia" className="underline">Come funziona e privacy</Link>
          </p>
          <div className="flex-1 overflow-y-auto p-3 space-y-2" role="log" aria-live="polite" aria-relevant="additions">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex flex-col items-end gap-1" : "flex"}>
                {m.image && <img src={m.image} alt="Foto inviata" data-testid="assistant-msg-photo" className="max-w-[60%] max-h-40 object-cover border border-[#D6D3D1]" />}
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
          {(photo || photoErr) && (
            <div className="border-t border-[#D6D3D1] bg-white px-2 pt-2 text-xs" data-testid="assistant-photo-preview">
              {photo && (
                <div className="flex items-center gap-2">
                  <img src={photo} alt="Foto da inviare" className="w-14 h-14 object-cover border border-[#D6D3D1]" />
                  <span className="flex-1 text-[#57534E]">Foto pronta. Aggiungi una domanda o premi Invia. Confronto indicativo: per il colore esatto chiedi i campioni. Max 1 foto all'ora.</span>
                  <button type="button" onClick={() => setPhoto(null)} aria-label="Rimuovi foto" data-testid="assistant-photo-remove" className="px-2 text-lg leading-none text-[#57534E]">×</button>
                </div>
              )}
              {photoErr && <p role="alert" className="text-[#B91C1C]">{photoErr}</p>}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[#D6D3D1] p-2 flex gap-2 bg-white">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="hidden" data-testid="assistant-photo-input" tabIndex={-1} aria-hidden="true" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || limitReached}
              aria-label="Allega una foto (per esempio del pavimento) per abbinare un battiscopa" title="Allega una foto"
              data-testid="assistant-photo-btn" className="border border-[#A8A29E] px-2 text-[#57534E] disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </button>
            <label className="sr-only" htmlFor="glaze-input">Scrivi un messaggio</label>
            <input id="glaze-input" ref={inputRef} value={input} maxLength={500} onChange={(e) => setInput(e.target.value)}
              disabled={limitReached} placeholder={limitReached ? "Limite raggiunto: chiedi a una persona" : photo ? "Domanda sulla foto (facoltativa)…" : "Scrivi qui…"}
              className="flex-1 min-w-0 border border-[#A8A29E] px-2 py-1.5 text-sm" />
            <button disabled={busy || limitReached || (!input.trim() && !photo)} className="bg-[#A64B32] text-white text-sm px-3 disabled:opacity-60">Invia</button>
          </form>
        </div>
      )}
    </>
  );
}
