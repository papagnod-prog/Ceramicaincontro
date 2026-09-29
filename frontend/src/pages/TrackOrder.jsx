import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { Package, CheckCircle2, Truck, Clock, XCircle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_COLOR = {
  pending: "bg-[#F1EEE8] text-[#78716C]",
  processing: "bg-[#EAF0EC] text-[#6B7A6E]",
  shipped: "bg-[#E7EDF4] text-[#4A6785]",
  delivered: "bg-[#E4EFE6] text-[#3F7A4F]",
  cancelled: "bg-[#FBEAE5] text-[#A64B32]",
  refunded: "bg-[#F3EAE0] text-[#8C6A4A]",
};

const STATUS_ICON = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: XCircle,
};

export default function TrackOrder() {
  usePageTitle("Stato ordine");
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/track/${orderNumber}`)
      .then(({ data }) => setOrder(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-[#78716C]">Caricamento…</div>;

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center" data-testid="track-order-not-found">
        <h1 className="text-2xl font-serif text-[#1C1917] mb-3">Ordine non trovato</h1>
        <p className="text-[#78716C] text-sm mb-6">
          Controlla il link ricevuto per email o il numero d&rsquo;ordine <strong>{orderNumber}</strong>.
        </p>
        <Link to="/" className="text-[#C05A3E] underline text-sm">Torna alla home</Link>
      </div>
    );
  }

  const Icon = STATUS_ICON[order.status] || Package;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16" data-testid="track-order-page">
      <p className="text-xs uppercase tracking-wide text-[#78716C] mb-2">Stato dell&rsquo;ordine</p>
      <h1 className="text-2xl font-serif text-[#1C1917] mb-1">{order.order_number}</h1>
      <p className="text-sm text-[#78716C] mb-8">Ciao {order.customer_name || "cliente"}, ecco l&rsquo;ultimo aggiornamento sul tuo ordine.</p>

      <div className="border border-[#E2DDD5] bg-white p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${STATUS_COLOR[order.status] || "bg-[#F1EEE8] text-[#78716C]"}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-medium text-[#1C1917]" data-testid="track-order-status">{order.status_label}</div>
            {order.updated_at && (
              <div className="text-xs text-[#78716C]">
                Aggiornato il {new Date(order.updated_at).toLocaleDateString("it-IT")}
              </div>
            )}
          </div>
        </div>
        {order.tracking && (
          <div className="text-sm text-[#57534E] border-t border-[#E2DDD5] pt-4 mt-2">
            Codice tracking: <strong>{order.tracking}</strong>
          </div>
        )}
      </div>

      <div className="border border-[#E2DDD5] bg-white p-6">
        <h2 className="text-sm font-medium text-[#1C1917] mb-3">Riepilogo</h2>
        <div className="space-y-2 mb-4">
          {(order.items || []).map((it, i) => (
            <div key={i} className="flex justify-between text-sm text-[#57534E]">
              <span>{it.name} &times; {it.quantity}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-[#78716C] border-t border-[#E2DDD5] pt-3">
          <span>Spedizione</span><span>{order.shipping_option}</span>
        </div>
        <div className="flex justify-between text-sm font-medium text-[#1C1917] pt-1">
          <span>Totale</span><span>{eur(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
