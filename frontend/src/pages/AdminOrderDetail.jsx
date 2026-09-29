import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_OPTS = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
const STATUS_LABEL = {
  pending: "In attesa", processing: "In lavorazione", shipped: "Spedito",
  delivered: "Consegnato", cancelled: "Annullato", refunded: "Rimborsato",
};

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
    await api.put(`/admin/orders/${orderId}/status`, { status, tracking: order.tracking || "" });
    toast.success("Stato aggiornato");
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
            <div className="text-xs text-[#78716C]">{order.payment_method === "bank_transfer" ? "Bonifico bancario" : "Carta"} · {order.payment_status}</div>
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
              {STATUS_OPTS.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>))}
            </SelectContent>
          </Select>
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
    </div>
  );
}
