import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, FileText, Printer, Upload } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { paymentLabel } from "@/lib/payment";

const STATUS_OPTS = ["pending", "processing", "shipped", "delivered", "invoiced", "cancelled", "refunded"];
const STATUS_LABEL = {
  pending: "In attesa", processing: "In lavorazione", shipped: "Spedito",
  delivered: "Consegnato", invoiced: "Fatturato", cancelled: "Annullato", refunded: "Rimborsato",
};
/** Messaggio dopo il cambio di stato: per "Fatturato" dice se l'email con il PDF è partita. */
const statusToast = (status, order) => {
  if (status !== "invoiced") return toast.success("Stato aggiornato");
  const r = order?.invoice_email;
  if (r && !r.ok) return toast.error(`Stato aggiornato, ma ${r.error || "email non inviata"}`);
  return toast.success("Stato aggiornato · email con il PDF inviata al cliente");
};

const MAX_PDF = 4 * 1024 * 1024;
const KIND_LABEL = { fattura: "Fattura", ricevuta: "Ricevuta" };

const readBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

const apiError = (err) => toast.error(formatApiErrorDetail(err.response?.data?.detail));

/** Fattura o ricevuta (PDF) dell'ordine: la vede solo l'amministratore, al cliente arriva per email. */
function InvoiceBox({ order, onChange }) {
  const inv = order.invoice;
  const sent = order.invoice_email;
  const [kind, setKind] = useState(inv?.kind || (order.billing?.is_business ? "fattura" : "ricevuta"));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (inv?.kind) setKind(inv.kind); }, [inv?.kind]);

  const upload = async (file) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) return toast.error("Scegli un file PDF");
    if (file.size > MAX_PDF) return toast.error("Il PDF supera i 4 MB");
    setBusy(true);
    try {
      const data_b64 = await readBase64(file);
      await api.put(`/admin/orders/${order.id}/invoice`, { kind, filename: file.name, data_b64 });
      toast.success(inv ? "PDF sostituito" : "PDF allegato");
      onChange();
    } catch (err) {
      apiError(err);
    } finally {
      setBusy(false);
    }
  };

  const changeKind = async (k) => {
    setKind(k);
    if (!inv || inv.kind === k) return;
    try {
      await api.put(`/admin/orders/${order.id}/invoice`, { kind: k, filename: "", data_b64: "" });
      onChange();
    } catch (err) {
      setKind(inv.kind);
      apiError(err);
    }
  };

  const openPdf = async () => {
    const w = window.open("", "_blank");
    try {
      const { data } = await api.get(`/admin/orders/${order.id}/invoice`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      if (w) w.location.href = url; else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (w) w.close();
      toast.error("PDF non disponibile");
    }
  };

  const removePdf = async () => {
    if (!window.confirm("Togliere il PDF allegato a questo ordine?")) return;
    try {
      await api.delete(`/admin/orders/${order.id}/invoice`);
      toast.success("PDF tolto");
      onChange();
    } catch (err) {
      apiError(err);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orders/${order.id}/invoice/send`);
      const r = data?.invoice_email;
      if (r && !r.ok) toast.error(r.error || "Email non inviata"); else toast.success("Email con il PDF inviata");
      onChange();
    } catch (err) {
      apiError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print mt-6 border border-[#E2DDD5] bg-white p-6" data-testid="invoice-box">
      <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-3 font-medium">Fattura o ricevuta (PDF)</h2>
      <div className="flex flex-wrap items-center gap-5 mb-4 text-sm" role="radiogroup" aria-label="Tipo di documento">
        {Object.entries(KIND_LABEL).map(([k, l]) => (
          <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="invoice-kind" value={k} checked={kind === k} onChange={() => changeKind(k)}
              className="accent-[#C05A3E]" data-testid={`invoice-kind-${k}`} />
            {l}
          </label>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" data-testid="invoice-file"
        onChange={(e) => upload(e.target.files?.[0])} />

      {inv ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="invoice-current">
          <FileText className="w-5 h-5 text-[#C05A3E] shrink-0" />
          <div className="text-sm mr-auto">
            <div className="font-medium text-[#1C1917]">{KIND_LABEL[inv.kind]}: {inv.filename}</div>
            <div className="text-xs text-[#78716C]">
              {(inv.size / 1024).toFixed(0)} KB · caricato il {new Date(inv.uploaded_at).toLocaleString("it-IT")}
            </div>
          </div>
          <button type="button" onClick={openPdf} data-testid="invoice-open"
            className="text-sm px-3 py-2 border border-[#E2DDD5] hover:bg-[#F1EEE8]">Apri</button>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="invoice-replace"
            className="text-sm px-3 py-2 border border-[#E2DDD5] hover:bg-[#F1EEE8] disabled:opacity-50">Sostituisci</button>
          <button type="button" disabled={busy} onClick={removePdf} data-testid="invoice-remove"
            className="text-sm px-3 py-2 border border-[#E2DDD5] text-[#A64B32] hover:bg-[#FBEAE5] disabled:opacity-50">Togli</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="invoice-upload"
            className="inline-flex items-center gap-2 bg-[#1C1917] text-white text-sm px-4 py-2 hover:bg-[#3D3835] disabled:opacity-50">
            <Upload className="w-4 h-4" /> {busy ? "Caricamento…" : "Allega PDF"}
          </button>
          <span className="text-xs text-[#78716C]">Solo PDF, massimo 4 MB. Il cliente lo riceve per email quando l'ordine passa a «Fatturato».</span>
        </div>
      )}

      {sent && (
        <div data-testid="invoice-email-result"
          className={`mt-4 p-3 text-sm flex flex-wrap items-center gap-3 ${sent.ok ? "bg-[#E6EEE9] text-[#2F5E46]" : "bg-[#FBEAE5] text-[#A64B32]"}`}>
          <span className="mr-auto">
            {sent.ok
              ? `Email con il PDF inviata a ${sent.to} il ${new Date(sent.at).toLocaleString("it-IT")}.`
              : `Email NON inviata (${new Date(sent.at).toLocaleString("it-IT")}): ${sent.error || "errore sconosciuto"}`}
          </span>
          {inv && (
            <button type="button" disabled={busy} onClick={resend} data-testid="invoice-resend"
              className="text-sm px-3 py-1.5 bg-white border border-current hover:opacity-80 disabled:opacity-50">
              {busy ? "Invio…" : "Invia di nuovo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}


export default function AdminOrderDetail() {
  usePageTitle("Dettaglio ordine");
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login");
  }, [loading, user, navigate]);

  const load = () => {
    api.get(`/orders/${orderId}`).then(({ data }) => { setOrder(data); setTracking(data.tracking || ""); }).catch(() => setOrder(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.role === "admin") load(); }, [user, orderId]);

  const updateStatus = async (status) => {
    try {
      const { data } = await api.put(`/admin/orders/${orderId}/status`, { status, tracking: order.tracking || "" });
      statusToast(status, data);
    } catch (err) {
      apiError(err);
    }
    load();
  };

  const saveTracking = async () => {
    await api.put(`/admin/orders/${orderId}/status`, { status: order.status, tracking });
    toast.success("Tracking salvato");
    load();
  };

  if (loading || !user || user.role !== "admin") return null;
  if (order === null) return <div className="max-w-4xl mx-auto px-4 py-16 text-[#78716C]">Caricamento…</div>;
  if (order === false) return <div className="max-w-4xl mx-auto px-4 py-16 text-[#78716C]">Ordine non trovato.</div>;

  const addr = order.shipping_address || {};
  const billing = order.billing || {};
  const customer = order.customer || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-10" data-testid="admin-order-detail-page">
      <div className="no-print flex items-center justify-between mb-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917]">
          <ArrowLeft className="w-4 h-4" /> Torna agli ordini
        </Link>
        <button
          onClick={() => window.print()}
          data-testid="admin-print-order-btn"
          className="inline-flex items-center gap-2 bg-[#1C1917] text-white text-sm px-4 py-2 hover:bg-[#3D3835]"
        >
          <Printer className="w-4 h-4" /> Stampa ordine
        </button>
      </div>

      <div className="print-area border border-[#E2DDD5] bg-white p-8">
        <div className="flex justify-between items-start mb-6 border-b border-[#E2DDD5] pb-4">
          <div>
            <h1 className="text-2xl font-serif text-[#1C1917]">Ordine {order.order_number}</h1>
            <p className="text-sm text-[#78716C]">{new Date(order.created_at).toLocaleString("it-IT")}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{STATUS_LABEL[order.status] || order.status}</div>
            <div className="text-xs text-[#78716C]">{paymentLabel(order)}</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Cliente</h2>
            <p className="text-sm text-[#1C1917] font-medium">{customer.name}</p>
            <p className="text-sm text-[#57534E]">{customer.email}</p>
            <p className="text-sm text-[#57534E]">{customer.phone}</p>
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Spedizione a</h2>
            <p className="text-sm text-[#57534E]">{addr.line1}</p>
            <p className="text-sm text-[#57534E]">{addr.postal_code} {addr.city} {addr.province} — {addr.region}</p>
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Fatturazione</h2>
            {billing.is_business ? (
              <>
                <p className="text-sm text-[#57534E]">{billing.company}</p>
                <p className="text-sm text-[#57534E]">P.IVA: {billing.vat_number}</p>
                {billing.sdi_code && <p className="text-sm text-[#57534E]">SDI: {billing.sdi_code}</p>}
                {billing.pec_address && <p className="text-sm text-[#57534E]">PEC: {billing.pec_address}</p>}
              </>
            ) : (
              <>
                <p className="text-sm text-[#57534E]">Privato</p>
                {billing.codice_fiscale && <p className="text-sm text-[#57534E]">C.F.: {billing.codice_fiscale}</p>}
              </>
            )}
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Metodo di spedizione</h2>
            <p className="text-sm text-[#57534E]">{order.shipping_option?.name}</p>
            <p className="text-sm text-[#57534E]">Peso totale: {order.weight_kg} kg</p>
            {order.tracking && <p className="text-sm text-[#57534E]">Tracking: <strong>{order.tracking}</strong></p>}
          </div>
        </div>

        {(order.withdrawals || []).length > 0 && (
          <div className="mb-6 border border-[#C05A3E] bg-[#FBEAE5] p-4" data-testid="admin-order-withdrawals">
            <h2 className="text-xs uppercase tracking-wide text-[#A64B32] mb-2 font-medium">Recesso richiesto dal cliente</h2>
            {order.withdrawals.map((w) => (
              <div key={w.id} className="text-sm text-[#1C1917] mb-2 last:mb-0">
                <p><strong>{w.request_number}</strong> · ricevuta il {new Date(w.received_at).toLocaleString("it-IT")}</p>
                <ul className="list-disc pl-5 text-[#57534E]">
                  {(w.items || []).map((it, i) => (<li key={i}>{it.name} × {it.quantity}{it.ordered_quantity ? ` (su ${it.ordered_quantity})` : ""}</li>))}
                </ul>
                {w.note && <p className="text-[#57534E]">Nota: {w.note}</p>}
              </div>
            ))}
            {billing.is_business && <p className="text-xs text-[#A64B32] mt-2">Cliente azienda: per legge il recesso spetta solo ai consumatori.</p>}
          </div>
        )}

        <h2 className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Articoli — per la preparazione</h2>
        <table className="w-full text-sm mb-6 border border-[#E2DDD5]">
          <thead className="bg-[#F1EEE8] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Prodotto</th>
              <th className="px-3 py-2 font-medium">Collezione</th>
              <th className="px-3 py-2 font-medium text-right">Qtà</th>
              <th className="px-3 py-2 font-medium text-right">Prezzo</th>
              <th className="px-3 py-2 font-medium text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it, i) => (
              <tr key={i} className="border-t border-[#E2DDD5]">
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2 text-[#78716C]">{it.collection}</td>
                <td className="px-3 py-2 text-right">{it.quantity}</td>
                <td className="px-3 py-2 text-right">{eur(it.price)}</td>
                <td className="px-3 py-2 text-right font-medium">{eur(it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="text-sm w-64">
            <tbody>
              <tr><td className="py-1 text-[#78716C]">Subtotale</td><td className="py-1 text-right">{eur(order.subtotal)}</td></tr>
              <tr><td className="py-1 text-[#78716C]">Spedizione</td><td className="py-1 text-right">{eur(order.shipping_cost)}</td></tr>
              {order.vat_amount_products != null && (
                <tr><td className="py-1 text-[#78716C]">IVA</td><td className="py-1 text-right">{eur((order.vat_amount_products || 0) + (order.vat_amount_shipping || 0))}</td></tr>
              )}
              <tr className="border-t border-[#E2DDD5]"><td className="py-2 font-medium">Totale</td><td className="py-2 text-right font-medium">{eur(order.total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="no-print mt-6 border border-[#E2DDD5] bg-white p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#78716C] mb-1.5">Stato ordine</label>
          <Select value={order.status} onValueChange={updateStatus}>
            <SelectTrigger data-testid="admin-order-detail-status" className="h-10 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              {STATUS_OPTS.map((s) => (s === "invoiced" && !order.invoice && order.status !== "invoiced"
                ? <SelectItem key={s} value={s} disabled>Fatturato (allega prima il PDF)</SelectItem>
                : <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>))}
            </SelectContent>
          </Select>
          {!order.invoice && order.status !== "invoiced" && (
            <p data-testid="invoice-needed-hint" className="text-xs text-[#78716C] mt-1.5">
              Per «Fatturato» allega prima la fattura o la ricevuta qui sotto.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#78716C] mb-1.5">Codice tracking</label>
          <div className="flex gap-2">
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Cod. tracking"
              className="flex-1 border border-[#E2DDD5] px-3 py-2 text-sm focus:outline-none focus:border-[#C05A3E]"
            />
            <button onClick={saveTracking} className="bg-[#1C1917] text-white text-sm px-4 py-2 hover:bg-[#3D3835]">Salva</button>
          </div>
        </div>
      </div>

      <InvoiceBox order={order} onChange={load} />
    </div>
  );
}
