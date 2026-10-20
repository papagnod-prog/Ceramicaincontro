import { useCallback, useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2, Image as ImageIcon } from "lucide-react";

const PAGE = 20;
const fmt = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

// Foto caricata con il token admin (un <img src> diretto non manderebbe l'autorizzazione).
function ChatPhoto({ id }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let u = null; let alive = true;
    api.get(`/admin/assistant/photos/${id}`, { responseType: "blob" })
      .then(({ data }) => { u = URL.createObjectURL(data); if (alive) setUrl(u); })
      .catch(() => alive && setErr(true));
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  if (err) return <p className="text-xs text-[#78716C]">(foto non più disponibile)</p>;
  if (!url) return <div className="w-40 h-28 bg-[#E7E5E4] animate-pulse" aria-label="Caricamento foto" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Apri la foto a grandezza piena">
      <img src={url} alt="Foto inviata dal cliente" data-testid="admin-chat-photo" className="max-w-[260px] max-h-60 object-cover border border-[#E2DDD5]" />
    </a>
  );
}

export default function AdminChats({ initialChatId = null }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const [openId, setOpenId] = useState(initialChatId);
  const [chat, setChat] = useState(null);
  const [chatErr, setChatErr] = useState("");
  const [retention, setRetention] = useState(183);

  const load = useCallback(() => {
    setStatus("loading");
    api.get("/admin/assistant/chats", { params: { skip, limit: PAGE, q: query } })
      .then(({ data }) => { setItems(data.items); setTotal(data.total); setRetention(data.retention_days); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [skip, query]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!openId) { setChat(null); return; }
    setChat(null); setChatErr("");
    api.get(`/admin/assistant/chats/${openId}`)
      .then(({ data }) => setChat(data))
      .catch((e) => setChatErr(formatApiErrorDetail(e?.response?.data?.detail)));
  }, [openId]);

  const remove = async (id) => {
    if (!window.confirm("Eliminare definitivamente questa chat e le sue foto? L'operazione non si può annullare.")) return;
    try {
      await api.delete(`/admin/assistant/chats/${id}`);
      toast.success("Chat eliminata");
      setOpenId(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail));
    }
  };

  if (openId) {
    return (
      <div data-testid="admin-chat-detail">
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-4">
          <ArrowLeft className="w-4 h-4" /> Tutte le chat
        </button>
        {chatErr && <p role="alert" className="text-sm text-[#B91C1C]">{chatErr}</p>}
        {!chat && !chatErr && <p className="text-sm text-[#78716C]">Caricamento…</p>}
        {chat && (
          <div className="bg-white border border-[#E2DDD5] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="text-sm text-[#57534E] space-y-0.5">
                <p>Iniziata il <strong className="text-[#1C1917]">{fmt(chat.created_at)}</strong> · ultimo messaggio {fmt(chat.updated_at)}</p>
                <p>{chat.turns || 0} domande · {chat.photos || 0} foto · costo ${chat.usd}{chat.page ? ` · pagina ${chat.page}` : ""}</p>
                {chat.support_request && <p>Richiesta di assistenza: <strong className="text-[#1C1917]">{chat.support_request}</strong></p>}
                {chat.expires_on && <p>Cancellazione automatica il {new Date(chat.expires_on).toLocaleDateString("it-IT")}</p>}
              </div>
              <button onClick={() => remove(chat.id)} data-testid="admin-chat-delete"
                className="inline-flex items-center gap-2 text-sm border border-[#B91C1C] text-[#B91C1C] px-3 py-2 hover:bg-[#FEF2F2]">
                <Trash2 className="w-4 h-4" /> Elimina chat
              </button>
            </div>
            <div className="space-y-3 border-t border-[#E2DDD5] pt-4">
              {(chat.messages || []).map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-1"}>
                  <span className="text-[11px] text-[#78716C]">{m.role === "user" ? "Cliente" : "Glaze"} · {fmt(m.at)}</span>
                  {m.photo_id && <ChatPhoto id={m.photo_id} />}
                  <p className={`text-sm px-3 py-2 max-w-[80%] whitespace-pre-wrap ${m.role === "user" ? "bg-[#A64B32] text-white" : "bg-[#F8F6F2] border border-[#E2DDD5] text-[#1C1917]"}`}>{m.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div data-testid="admin-chats">
      <p className="text-sm text-[#57534E] mb-4">
        Conversazioni dei clienti con Glaze. Email e numeri di telefono sono già oscurati. Ogni chat si cancella da sola dopo {Math.round(retention / 30.5)} mesi dall'ultimo messaggio.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); setSkip(0); setQuery(q.trim()); }} className="flex gap-2 mb-4 max-w-md">
        <div className="relative flex-1 flex items-center">
          <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nelle chat"
            placeholder="Cerca una parola o un numero AS-…" data-testid="admin-chats-search"
            className="w-full h-10 pl-9 pr-3 bg-white border border-[#E2DDD5] text-sm focus:outline-none focus:border-[#C05A3E]" />
        </div>
        <button className="h-10 px-4 bg-[#1C1917] text-white text-sm">Cerca</button>
      </form>
      {status === "loading" && <p className="text-sm text-[#78716C]">Caricamento…</p>}
      {status === "error" && <p role="alert" className="text-sm text-[#B91C1C]">Non riesco a caricare le chat. Riprova.</p>}
      {status === "ready" && items.length === 0 && <p className="text-sm text-[#78716C]">{query ? "Nessuna chat trovata." : "Ancora nessuna chat salvata."}</p>}
      {status === "ready" && items.length > 0 && (
        <div className="bg-white border border-[#E2DDD5] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F6F2] text-left text-xs text-[#57534E]">
              <tr><th className="p-3">Ultimo messaggio</th><th className="p-3">Prima domanda</th><th className="p-3">Domande</th><th className="p-3">Foto</th><th className="p-3">Assistenza</th><th className="p-3">Costo</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-[#E2DDD5] hover:bg-[#FAFAF9]">
                  <td className="p-3 whitespace-nowrap">{fmt(c.updated_at)}</td>
                  <td className="p-3 max-w-md truncate" title={c.preview}>{c.preview}</td>
                  <td className="p-3">{c.turns || 0}</td>
                  <td className="p-3">{c.photos ? <span className="inline-flex items-center gap-1"><ImageIcon className="w-4 h-4" aria-hidden="true" />{c.photos}</span> : "—"}</td>
                  <td className="p-3 whitespace-nowrap">{c.support_request || "—"}</td>
                  <td className="p-3">${c.usd}</td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <button onClick={() => setOpenId(c.id)} data-testid={`admin-chat-open-${c.id}`} className="underline text-[#A64B32] mr-3">Apri</button>
                    <button onClick={() => remove(c.id)} aria-label="Elimina chat" className="text-[#B91C1C] align-middle"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === "ready" && total > PAGE && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))} className="border border-[#E2DDD5] px-3 py-1.5 disabled:opacity-50">Precedenti</button>
          <span>Pagina {Math.floor(skip / PAGE) + 1} di {pages} · {total} chat</span>
          <button disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)} className="border border-[#E2DDD5] px-3 py-1.5 disabled:opacity-50">Successive</button>
        </div>
      )}
    </div>
  );
}
