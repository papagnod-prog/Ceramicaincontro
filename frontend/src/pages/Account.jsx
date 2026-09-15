import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Package, ShieldCheck } from "lucide-react";

const STATUS_LABEL = {
  pending: "In attesa di pagamento",
  processing: "In lavorazione",
  shipped: "Spedito",
  delivered: "Consegnato",
  cancelled: "Annullato",
  refunded: "Rimborsato",
};
const STATUS_COLOR = {
  pending: "bg-[#F1EEE8] text-[#78716C]",
  processing: "bg-[#EAF0EC] text-[#6B7A6E]",
  shipped: "bg-[#E7EDF4] text-[#4A6785]",
  delivered: "bg-[#E4EFE6] text-[#3F7A4F]",
  cancelled: "bg-[#FBEAE5] text-[#A64B32]",
  refunded: "bg-[#F3EAE0] text-[#8C6A4A]",
};

export default function Account() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) api.get("/orders").then(({ data }) => setOrders(data)).catch(() => {});
  }, [user]);

  if (loading || !user)
    return <div className="max-w-5xl mx-auto px-4 py-24 text-[#78716C]">Caricamento…</div>;

  return (
    <div data-testid="customer-account-dashboard" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <p className="eyebrow text-[#C05A3E] mb-1">Il mio account</p>
          <h1 className="font-serif-display text-4xl font-light">Ciao, {user.name || "cliente"}</h1>
          <p className="text-sm text-[#78716C] mt-1">{user.email}</p>
        </div>
        <div className="flex gap-3">
          {user.role === "admin" && (
            <button onClick={() => navigate("/admin")} data-testid="go-admin-btn"
              className="inline-flex items-center gap-2 bg-[#1C1917] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#C05A3E] transition-colors">
              <ShieldCheck className="w-4 h-4" /> Pannello admin
            </button>
          )}
          <button onClick={() => logout().then(() => navigate("/"))} data-testid="logout-btn"
            className="inline-flex items-center gap-2 border border-[#E2DDD5] px-5 py-2.5 text-sm font-medium hover:bg-white transition-colors">
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
      </div>

      <h2 className="eyebrow mb-5">I miei ordini</h2>
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white border border-[#E2DDD5]">
          <Package className="w-10 h-10 text-[#C0B9AE] mx-auto mb-3" strokeWidth={1} />
          <p className="text-[#78716C]">Non hai ancora effettuato ordini.</p>
          <button onClick={() => navigate("/negozio")} className="mt-4 text-[#C05A3E] font-medium ci-link-underline">Vai al negozio</button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} data-testid="customer-order-item" className="bg-white border border-[#E2DDD5] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="font-semibold">{o.order_number}</p>
                  <p className="text-xs text-[#78716C]">{new Date(o.created_at).toLocaleDateString("it-IT")}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${STATUS_COLOR[o.status] || "bg-[#F1EEE8]"}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[#57534E]">
                    <span>{it.name} × {it.quantity}</span>
                    <span>{eur(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-[#E2DDD5] mt-3 pt-3 text-sm">
                <span className="text-[#78716C]">Spedizione: {o.shipping_option?.name} {o.tracking ? `· ${o.tracking}` : ""}</span>
                <span className="font-semibold">Totale {eur(o.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
