import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  LayoutGrid, Package, ClipboardList, Plus, Pencil, Trash2, X, ArrowLeft, Beaker, FileText,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_OPTS = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
const STATUS_LABEL = {
  pending: "In attesa", processing: "In lavorazione", shipped: "Spedito",
  delivered: "Consegnato", cancelled: "Annullato", refunded: "Rimborsato",
};

const SAMPLE_STATUS_OPTS = ["requested", "preparing", "shipped", "delivered"];
const SAMPLE_STATUS_LABEL = {
  requested: "Richiesto", preparing: "In preparazione", shipped: "Spedito", delivered: "Consegnato",
};

const QUOTE_STATUS_OPTS = ["new", "in_review", "quoted", "won", "lost"];
const QUOTE_STATUS_LABEL = {
  new: "Nuovo", in_review: "In valutazione", quoted: "Preventivo inviato",
  won: "Vinto", lost: "Perso",
};

const EMPTY_PRODUCT = {
  name: "", collection: "SMUSSO", description: "", price: "", format: "", finish: "Matt",
  color: "", usage: "Battiscopa", weight_kg: "", coverage_sqm: "", stock: 100, image: "", featured: false,
};

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [samples, setSamples] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [editing, setEditing] = useState(null); // product being edited or null
  const [form, setForm] = useState(EMPTY_PRODUCT);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login");
  }, [loading, user, navigate]);

  const loadAll = () => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/products").then(({ data }) => setProducts(data));
    api.get("/admin/orders").then(({ data }) => setOrders(data)).catch(() => {});
    api.get("/admin/samples").then(({ data }) => setSamples(data)).catch(() => {});
    api.get("/admin/quotes").then(({ data }) => setQuotes(data)).catch(() => {});
  };
  useEffect(() => {
    if (user?.role === "admin") loadAll();
  }, [user]);

  if (loading || !user || user.role !== "admin")
    return <div className="max-w-6xl mx-auto px-4 py-24 text-[#78716C]">Caricamento…</div>;

  const openNew = () => {
    setForm(EMPTY_PRODUCT);
    setEditing("new");
  };
  const openEdit = (p) => {
    setForm({ ...EMPTY_PRODUCT, ...p });
    setEditing(p.id);
  };
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: parseFloat(form.price),
      weight_kg: parseFloat(form.weight_kg) || 0,
      coverage_sqm: parseFloat(form.coverage_sqm) || 1,
      stock: parseInt(form.stock) || 0,
      gallery: [],
    };
    try {
      if (editing === "new") await api.post("/admin/products", payload);
      else await api.put(`/admin/products/${editing}`, payload);
      toast.success("Prodotto salvato");
      setEditing(null);
      loadAll();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Eliminare questo prodotto?")) return;
    await api.delete(`/admin/products/${id}`);
    toast.success("Prodotto eliminato");
    loadAll();
  };

  const updateOrderStatus = async (order, status) => {
    await api.put(`/admin/orders/${order.id}/status`, { status, tracking: order.tracking || "" });
    toast.success("Stato aggiornato");
    loadAll();
  };
  const updateTracking = async (order, tracking) => {
    await api.put(`/admin/orders/${order.id}/status`, { status: order.status, tracking });
    toast.success("Tracking salvato");
    loadAll();
  };

  const updateSampleStatus = async (req, status) => {
    await api.put(`/admin/samples/${req.id}/status`, { status, tracking: req.tracking || "" });
    toast.success("Stato campione aggiornato");
    loadAll();
  };
  const updateSampleTracking = async (req, tracking) => {
    await api.put(`/admin/samples/${req.id}/status`, { status: req.status, tracking });
    toast.success("Tracking campione salvato");
    loadAll();
  };

  const updateQuoteStatus = async (q, status) => {
    await api.put(`/admin/quotes/${q.id}/status`, { status, quoted_amount: q.quoted_amount, admin_note: q.admin_note || "" });
    toast.success("Stato preventivo aggiornato");
    loadAll();
  };
  const updateQuoteAmount = async (q, quoted_amount) => {
    await api.put(`/admin/quotes/${q.id}/status`, { status: q.status, quoted_amount: quoted_amount ? parseFloat(quoted_amount) : null, admin_note: q.admin_note || "" });
    toast.success("Importo preventivo salvato");
    loadAll();
  };

  const inputCls = "w-full bg-white border border-[#E2DDD5] px-3 py-2 focus:outline-none focus:border-[#C05A3E] text-sm";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link to="/account" className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-6">
        <ArrowLeft className="w-4 h-4" /> Torna all'account
      </Link>
      <h1 className="font-serif-display text-4xl font-light mb-8">Pannello Amministrazione</h1>

      <div data-testid="admin-navigation-bar" className="flex gap-2 border-b border-[#E2DDD5] mb-8">
        {[
          ["dashboard", "Dashboard", LayoutGrid],
          ["products", "Prodotti", Package],
          ["orders", "Ordini", ClipboardList],
          ["samples", "Campioni", Beaker],
          ["quotes", "Preventivi", FileText],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            data-testid={`admin-tab-${k}`}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === k ? "border-[#C05A3E] text-[#1C1917]" : "border-transparent text-[#78716C] hover:text-[#1C1917]"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === "dashboard" && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" data-testid="admin-dashboard">
          {[
            ["Fatturato", eur(stats.revenue)],
            ["Ordini pagati", stats.paid_orders],
            ["In lavorazione", stats.processing_orders],
            ["Prodotti a catalogo", stats.products],
            ["Richieste campioni", stats.sample_requests ?? 0],
            ["Preventivi aperti", stats.open_quote_requests ?? 0],
          ].map(([label, val]) => (
            <div key={label} className="bg-white border border-[#E2DDD5] p-6">
              <p className="eyebrow mb-2">{label}</p>
              <p className="font-serif-display text-3xl">{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Products */}
      {tab === "products" && (
        <div>
          <div className="flex justify-between items-center mb-5">
            <p className="text-sm text-[#78716C]">{products.length} prodotti</p>
            <button onClick={openNew} data-testid="admin-add-product-btn"
              className="inline-flex items-center gap-2 bg-[#C05A3E] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors">
              <Plus className="w-4 h-4" /> Nuovo prodotto
            </button>
          </div>
          <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
            <table data-testid="admin-product-table" className="w-full text-sm">
              <thead className="bg-[#F1EEE8] text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Prodotto</th>
                  <th className="px-4 py-3 font-medium">Collezione</th>
                  <th className="px-4 py-3 font-medium">Prezzo</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-[#E2DDD5]">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-[#78716C]">{p.collection}</td>
                    <td className="px-4 py-3">{eur(p.price)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`} className="p-2 hover:bg-[#F1EEE8] rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteProduct(p.id)} data-testid={`delete-product-${p.id}`} className="p-2 hover:bg-[#FBEAE5] rounded text-[#C05A3E]"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === "orders" && (
        <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
          <table data-testid="admin-order-table" className="w-full text-sm">
            <thead className="bg-[#F1EEE8] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Ordine</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Totale</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[#E2DDD5]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.order_number}</div>
                    <div className="text-xs text-[#78716C]">{new Date(o.created_at).toLocaleDateString("it-IT")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.customer?.name}</div>
                    <div className="text-xs text-[#78716C]">{o.customer?.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{eur(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={o.payment_status === "paid" ? "text-[#3F7A4F]" : "text-[#78716C]"}>
                      {o.payment_status === "paid" ? "Pagato" : o.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <Select value={o.status} onValueChange={(v) => updateOrderStatus(o, v)}>
                      <SelectTrigger data-testid={`order-status-${o.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {STATUS_OPTS.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={o.tracking}
                      placeholder="Cod. tracking"
                      onBlur={(e) => { if (e.target.value !== o.tracking) updateTracking(o, e.target.value); }}
                      className="border border-[#E2DDD5] px-2 py-1.5 w-32 text-xs focus:outline-none focus:border-[#C05A3E]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="p-10 text-center text-[#78716C]">Nessun ordine.</div>}
        </div>
      )}

      {/* Samples */}
      {tab === "samples" && (
        <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
          <table data-testid="admin-sample-table" className="w-full text-sm">
            <thead className="bg-[#F1EEE8] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Richiesta</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Campioni</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.id} className="border-t border-[#E2DDD5]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.request_number}</div>
                    <div className="text-xs text-[#78716C]">{new Date(s.created_at).toLocaleDateString("it-IT")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.customer?.name}</div>
                    <div className="text-xs text-[#78716C]">{s.customer?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[#78716C]">
                    {(s.items || []).map((it) => it.name).join(", ")}
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <Select value={s.status} onValueChange={(v) => updateSampleStatus(s, v)}>
                      <SelectTrigger data-testid={`sample-status-${s.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {SAMPLE_STATUS_OPTS.map((st) => (<SelectItem key={st} value={st}>{SAMPLE_STATUS_LABEL[st]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={s.tracking}
                      placeholder="Cod. tracking"
                      onBlur={(e) => { if (e.target.value !== s.tracking) updateSampleTracking(s, e.target.value); }}
                      className="border border-[#E2DDD5] px-2 py-1.5 w-32 text-xs focus:outline-none focus:border-[#C05A3E]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {samples.length === 0 && <div className="p-10 text-center text-[#78716C]">Nessuna richiesta campioni.</div>}
        </div>
      )}

      {/* Quotes */}
      {tab === "quotes" && (
        <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
          <table data-testid="admin-quote-table" className="w-full text-sm">
            <thead className="bg-[#F1EEE8] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Richiesta</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Progetto</th>
                <th className="px-4 py-3 font-medium">Superficie</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Importo (€)</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-[#E2DDD5]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{q.request_number}</div>
                    <div className="text-xs text-[#78716C]">{new Date(q.created_at).toLocaleDateString("it-IT")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{q.customer?.name}{q.customer?.company ? ` · ${q.customer.company}` : ""}</div>
                    <div className="text-xs text-[#78716C]">{q.customer?.email}</div>
                    <div className="text-xs text-[#78716C]">{q.customer?.profession}</div>
                  </td>
                  <td className="px-4 py-3 text-[#78716C]">{q.project_type}</td>
                  <td className="px-4 py-3 text-[#78716C]">{q.sqm ? `${q.sqm} m²` : "-"}</td>
                  <td className="px-4 py-3 min-w-[170px]">
                    <Select value={q.status} onValueChange={(v) => updateQuoteStatus(q, v)}>
                      <SelectTrigger data-testid={`quote-status-${q.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {QUOTE_STATUS_OPTS.map((st) => (<SelectItem key={st} value={st}>{QUOTE_STATUS_LABEL[st]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={q.quoted_amount ?? ""}
                      placeholder="0.00"
                      onBlur={(e) => { if (e.target.value !== String(q.quoted_amount ?? "")) updateQuoteAmount(q, e.target.value); }}
                      className="border border-[#E2DDD5] px-2 py-1.5 w-24 text-xs focus:outline-none focus:border-[#C05A3E]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {quotes.length === 0 && <div className="p-10 text-center text-[#78716C]">Nessun preventivo richiesto.</div>}
        </div>
      )}

      {/* Product editor modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}
            className="bg-[#F8F6F2] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" data-testid="admin-product-form">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif-display text-2xl">{editing === "new" ? "Nuovo prodotto" : "Modifica prodotto"}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-2 hover:bg-[#F1EEE8] rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls + " col-span-2"} placeholder="Nome" required value={form.name} onChange={setF("name")} data-testid="pf-name" />
              <input className={inputCls} placeholder="Collezione" required value={form.collection} onChange={setF("collection")} data-testid="pf-collection" />
              <input className={inputCls} placeholder="Formato" value={form.format} onChange={setF("format")} data-testid="pf-format" />
              <input className={inputCls} placeholder="Finitura" value={form.finish} onChange={setF("finish")} />
              <input className={inputCls} placeholder="Colore" value={form.color} onChange={setF("color")} />
              <input className={inputCls} placeholder="Utilizzo" value={form.usage} onChange={setF("usage")} />
              <input className={inputCls} type="number" step="0.01" placeholder="Prezzo €" required value={form.price} onChange={setF("price")} data-testid="pf-price" />
              <input className={inputCls} type="number" step="0.01" placeholder="Peso kg" value={form.weight_kg} onChange={setF("weight_kg")} data-testid="pf-weight" />
              <input className={inputCls} type="number" step="0.01" placeholder="Copertura m²/pz" value={form.coverage_sqm} onChange={setF("coverage_sqm")} />
              <input className={inputCls} type="number" placeholder="Stock" value={form.stock} onChange={setF("stock")} />
              <input className={inputCls + " col-span-2"} placeholder="URL immagine" value={form.image} onChange={setF("image")} data-testid="pf-image" />
              <textarea className={inputCls + " col-span-2"} rows={3} placeholder="Descrizione" value={form.description} onChange={setF("description")} />
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="accent-[#C05A3E]" />
                In evidenza in homepage
              </label>
            </div>
            <button type="submit" data-testid="pf-save" className="w-full bg-[#C05A3E] text-white py-3 text-sm font-semibold hover:bg-[#A64B32] transition-colors mt-5">
              Salva prodotto
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
