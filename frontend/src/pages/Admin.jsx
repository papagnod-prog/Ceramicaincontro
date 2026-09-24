import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  LayoutGrid, Package, ClipboardList, Plus, Pencil, Trash2, X, ArrowLeft, Beaker, FileText, Truck,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_OPTS = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
const STATUS_LABEL = {
  pending: "In attesa", processing: "In lavorazione", shipped: "Spedito",
  delivered: "Consegnato", cancelled: "Annullato", refunded: "Rimborsato",
};

const SAMPLE_STATUS_OPTS = ["requested", "preparing", "shipped", "delivered"];
const SAMPLE_STATUS_LABEL = {
  pending_payment: "In attesa di pagamento", requested: "Richiesto", preparing: "In preparazione",
  shipped: "Spedito", delivered: "Consegnato", cancelled: "Annullato (pagamento scaduto)",
};

const QUOTE_STATUS_OPTS = ["new", "in_review", "quoted", "won", "lost"];
const QUOTE_STATUS_LABEL = {
  new: "Nuovo", in_review: "In valutazione", quoted: "Preventivo inviato",
  won: "Vinto", lost: "Perso",
};

const EMPTY_PRODUCT = {
  name: "", collection: "SMUSSO", description: "", price: "", format: "", finish: "Matt",
  color: "", usage: "Battiscopa", weight_kg: "", coverage_sqm: "", stock: 100, image: "", image2: "", image3: "", featured: false,
};

export default function Admin() {
  usePageTitle("Pannello Admin");
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

  // Shipping (regione x peso x categoria)
  const [shippingMethods, setShippingMethods] = useState([]);
  const [regions, setRegions] = useState([]);
  const [collectionsList, setCollectionsList] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [rates, setRates] = useState([]);
  const [unloading, setUnloading] = useState({ price: "", label: "" });
  const [vatRates, setVatRates] = useState({ vat_rate_products: "", vat_rate_shipping: "" });
  const [bracketForm, setBracketForm] = useState({ label: "", min_kg: "", max_kg: "", order: 0 });
  const [editingBracket, setEditingBracket] = useState(null);
  const [rateForm, setRateForm] = useState({ shipping_option_id: "", regions: [], categories: [], weight_bracket_id: "", price: "" });
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [rateFilter, setRateFilter] = useState({ shipping_option_id: "", collection: "" });

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
  const loadShipping = () => {
    api.get("/shipping/options").then(({ data }) => setShippingMethods(data)).catch(() => {});
    api.get("/shipping/regions").then(({ data }) => setRegions(data)).catch(() => {});
    api.get("/collections").then(({ data }) => setCollectionsList(data)).catch(() => {});
    api.get("/admin/shipping/weight-brackets").then(({ data }) => setBrackets(data)).catch(() => {});
    api.get("/admin/shipping/rates").then(({ data }) => setRates(data)).catch(() => {});
    api.get("/admin/shipping/unloading-service").then(({ data }) => setUnloading({ price: data.price, label: data.label })).catch(() => {});
    api.get("/admin/vat").then(({ data }) => setVatRates({ vat_rate_products: data.vat_rate_products, vat_rate_shipping: data.vat_rate_shipping })).catch(() => {});
  };
  useEffect(() => {
    if (user?.role === "admin") { loadAll(); loadShipping(); }
  }, [user]);

  if (loading || !user || user.role !== "admin")
    return <div className="max-w-6xl mx-auto px-4 py-24 text-[#78716C]">Caricamento…</div>;

  const openNew = () => {
    setForm(EMPTY_PRODUCT);
    setEditing("new");
  };
  const openEdit = (p) => {
    const gallery = p.gallery || [];
    setForm({ ...EMPTY_PRODUCT, ...p, image2: gallery[0] || "", image3: gallery[1] || "" });
    setEditing(p.id);
  };
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProduct = async (e) => {
    e.preventDefault();
    const { image2, image3, ...rest } = form;
    const payload = {
      ...rest,
      price: parseFloat(form.price),
      weight_kg: parseFloat(form.weight_kg) || 0,
      coverage_sqm: parseFloat(form.coverage_sqm) || 1,
      stock: parseInt(form.stock) || 0,
      gallery: [image2, image3].filter((u) => u && u.trim()),
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

  // --- Shipping: weight brackets ---
  const openNewBracket = () => { setBracketForm({ label: "", min_kg: "", max_kg: "", order: brackets.length }); setEditingBracket("new"); };
  const openEditBracket = (b) => { setBracketForm({ ...b, max_kg: b.max_kg ?? "" }); setEditingBracket(b.id); };
  const saveBracket = async (e) => {
    e.preventDefault();
    const payload = {
      label: bracketForm.label,
      min_kg: parseFloat(bracketForm.min_kg) || 0,
      max_kg: bracketForm.max_kg === "" ? null : parseFloat(bracketForm.max_kg),
      order: parseInt(bracketForm.order) || 0,
    };
    try {
      if (editingBracket === "new") await api.post("/admin/shipping/weight-brackets", payload);
      else await api.put(`/admin/shipping/weight-brackets/${editingBracket}`, payload);
      toast.success("Fascia di peso salvata");
      setEditingBracket(null);
      loadShipping();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };
  const deleteBracket = async (id) => {
    if (!window.confirm("Eliminare questa fascia di peso? Verranno eliminate anche le tariffe collegate.")) return;
    await api.delete(`/admin/shipping/weight-brackets/${id}`);
    toast.success("Fascia di peso eliminata");
    loadShipping();
  };

  // --- Shipping: unloading service ---
  const saveUnloading = async (e) => {
    e.preventDefault();
    try {
      await api.put("/admin/shipping/unloading-service", { price: parseFloat(unloading.price) || 0, label: unloading.label || "Servizio di scarico" });
      toast.success("Servizio di scarico salvato");
      loadShipping();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  // --- VAT rates ---
  const saveVat = async (e) => {
    e.preventDefault();
    try {
      await api.put("/admin/vat", {
        vat_rate_products: parseFloat(vatRates.vat_rate_products) || 0,
        vat_rate_shipping: parseFloat(vatRates.vat_rate_shipping) || 0,
      });
      toast.success("Aliquote IVA salvate");
      loadShipping();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  // --- Shipping: rates ---
  const saveRate = async (e) => {
    e.preventDefault();
    const { shipping_option_id, regions: selectedRegions, categories: selectedCategories, weight_bracket_id, price } = rateForm;
    if (!shipping_option_id || !selectedRegions?.length || !selectedCategories?.length || !weight_bracket_id || price === "") {
      toast.error("Compila tutti i campi della tariffa (seleziona almeno una regione e una categoria)");
      return;
    }
    try {
      const combos = [];
      selectedRegions.forEach((region) => selectedCategories.forEach((collection) => combos.push({ region, collection })));
      await Promise.all(
        combos.map(({ region, collection }) =>
          api.post("/admin/shipping/rates", { shipping_option_id, region, collection, weight_bracket_id, price: parseFloat(price) })
        )
      );
      toast.success(combos.length > 1 ? `Tariffa salvata per ${combos.length} combinazioni regione/categoria` : "Tariffa salvata");
      setRateForm((f) => ({ ...f, price: "" }));
      loadShipping();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };
  const toggleRateRegion = (r) => {
    setRateForm((f) => ({
      ...f,
      regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r],
    }));
  };
  const toggleRateCategory = (c) => {
    setRateForm((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));
  };
  const deleteRate = async (id) => {
    await api.delete(`/admin/shipping/rates/${id}`);
    toast.success("Tariffa eliminata");
    loadShipping();
  };
  const bracketLabel = (id) => brackets.find((b) => b.id === id)?.label || id;
  const methodLabel = (id) => shippingMethods.find((m) => m.id === id)?.name || id;
  const filteredRates = rates.filter(
    (r) =>
      (!rateFilter.shipping_option_id || r.shipping_option_id === rateFilter.shipping_option_id) &&
      (!rateFilter.collection || r.collection === rateFilter.collection)
  );

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
          ["shipping", "Spedizioni", Truck],
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
                    <span className={["paid", "cod_pending", "awaiting_transfer"].includes(o.payment_status) ? "text-[#3F7A4F]" : "text-[#78716C]"}>
                      {{
                        paid: "Pagato (carta)",
                        cod_pending: "Contanti alla consegna",
                        awaiting_transfer: "In attesa di bonifico",
                      }[o.payment_status] || o.payment_status}
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
                <th className="px-4 py-3 font-medium">Spedizione (&euro;6)</th>
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
                  <td className="px-4 py-3 text-[#78716C]">
                    {s.payment_method === "bank_transfer" ? "Bonifico" : "Carta"} &middot;{" "}
                    {s.payment_status === "paid" ? "Pagato" : s.payment_status === "awaiting_transfer" ? "In attesa" : s.payment_status === "pending" ? "In corso" : s.payment_status || "-"}
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

      {/* Shipping */}
      {tab === "shipping" && (
        <div className="space-y-10" data-testid="admin-shipping">
          {/* Weight brackets */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif-display text-2xl">Fasce di peso</h3>
              <button onClick={openNewBracket} data-testid="admin-add-bracket-btn"
                className="inline-flex items-center gap-2 bg-[#C05A3E] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors">
                <Plus className="w-4 h-4" /> Nuova fascia
              </button>
            </div>
            <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
              <table className="w-full text-sm" data-testid="admin-bracket-table">
                <thead className="bg-[#F1EEE8] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Etichetta</th>
                    <th className="px-4 py-3 font-medium">Min kg</th>
                    <th className="px-4 py-3 font-medium">Max kg</th>
                    <th className="px-4 py-3 font-medium">Ordine</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...brackets].sort((a, b) => a.min_kg - b.min_kg).map((b) => (
                    <tr key={b.id} className="border-t border-[#E2DDD5]">
                      <td className="px-4 py-3 font-medium">{b.label}</td>
                      <td className="px-4 py-3">{b.min_kg}</td>
                      <td className="px-4 py-3">{b.max_kg ?? "oltre"}</td>
                      <td className="px-4 py-3">{b.order}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEditBracket(b)} className="p-2 hover:bg-[#F1EEE8] rounded"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteBracket(b.id)} className="p-2 hover:bg-[#FBEAE5] rounded text-[#C05A3E]"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {brackets.length === 0 && <div className="p-8 text-center text-[#78716C]">Nessuna fascia di peso configurata.</div>}
            </div>
          </section>

          {/* VAT rates */}
          <section>
            <h3 className="font-serif-display text-2xl mb-4">Aliquote IVA</h3>
            <form onSubmit={saveVat} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end" data-testid="admin-vat-form">
              <div>
                <label className="text-xs text-[#78716C] block mb-1">IVA prodotti (%)</label>
                <input type="number" step="0.01" min="0" max="100" className={inputCls}
                  value={vatRates.vat_rate_products}
                  onChange={(e) => setVatRates((v) => ({ ...v, vat_rate_products: e.target.value }))}
                  data-testid="admin-vat-products" />
              </div>
              <div>
                <label className="text-xs text-[#78716C] block mb-1">IVA trasporto (%)</label>
                <input type="number" step="0.01" min="0" max="100" className={inputCls}
                  value={vatRates.vat_rate_shipping}
                  onChange={(e) => setVatRates((v) => ({ ...v, vat_rate_shipping: e.target.value }))}
                  data-testid="admin-vat-shipping" />
              </div>
              <button type="submit" className="bg-[#C05A3E] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors h-fit">Salva</button>
            </form>
            <p className="text-xs text-[#78716C] mt-2">I prezzi di prodotti e spedizione sono mostrati IVA esclusa. Queste aliquote vengono applicate al checkout.</p>
          </section>

          {/* Unloading service */}
          <section>
            <h3 className="font-serif-display text-2xl mb-4">Servizio di scarico (sponda idraulica + trans pallet)</h3>
            <form onSubmit={saveUnloading} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end" data-testid="admin-unloading-form">
              <div>
                <label className="text-xs text-[#78716C] block mb-1">Etichetta</label>
                <input className={inputCls} value={unloading.label} onChange={(e) => setUnloading((u) => ({ ...u, label: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-[#78716C] block mb-1">Prezzo (€)</label>
                <input type="number" step="0.01" className={inputCls} value={unloading.price} onChange={(e) => setUnloading((u) => ({ ...u, price: e.target.value }))} data-testid="admin-unloading-price" />
              </div>
              <button type="submit" className="bg-[#C05A3E] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors h-fit">Salva</button>
            </form>
          </section>

          {/* Rates matrix */}
          <section>
            <h3 className="font-serif-display text-2xl mb-4">Tariffe per regione, peso e categoria</h3>
            <form onSubmit={saveRate} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-5 gap-3 items-end mb-5" data-testid="admin-rate-form">
              <div>
                <label className="text-xs text-[#78716C] block mb-1">Metodo</label>
                <select className={inputCls} value={rateForm.shipping_option_id} onChange={(e) => setRateForm((f) => ({ ...f, shipping_option_id: e.target.value }))}>
                  <option value="">Seleziona…</option>
                  {shippingMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div className="relative">
                <label className="text-xs text-[#78716C] block mb-1">Regioni</label>
                <button
                  type="button"
                  data-testid="admin-rate-regions-toggle"
                  onClick={() => setRegionPickerOpen((o) => !o)}
                  className={inputCls + " text-left flex items-center justify-between"}
                >
                  <span className="truncate">
                    {rateForm.regions.length === 0
                      ? "Seleziona…"
                      : rateForm.regions.length === 1
                      ? rateForm.regions[0]
                      : `${rateForm.regions.length} regioni selezionate`}
                  </span>
                  <span className="text-[#78716C]">▾</span>
                </button>
                {regionPickerOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#E2DDD5] shadow-lg p-2" data-testid="admin-rate-regions-list">
                    <div className="flex justify-between mb-1 px-1">
                      <button type="button" className="text-xs text-[#C05A3E] hover:underline" onClick={() => setRateForm((f) => ({ ...f, regions: [...regions] }))}>Seleziona tutte</button>
                      <button type="button" className="text-xs text-[#78716C] hover:underline" onClick={() => setRateForm((f) => ({ ...f, regions: [] }))}>Deseleziona</button>
                    </div>
                    {regions.map((r) => (
                      <label key={r} className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-[#F1EEE8] cursor-pointer">
                        <input type="checkbox" checked={rateForm.regions.includes(r)} onChange={() => toggleRateRegion(r)} className="accent-[#C05A3E]" />
                        {r}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="text-xs text-[#78716C] block mb-1">Categorie</label>
                <button
                  type="button"
                  data-testid="admin-rate-categories-toggle"
                  onClick={() => setCategoryPickerOpen((o) => !o)}
                  className={inputCls + " text-left flex items-center justify-between"}
                >
                  <span className="truncate">
                    {rateForm.categories.length === 0
                      ? "Seleziona…"
                      : rateForm.categories.length === 1
                      ? rateForm.categories[0]
                      : `${rateForm.categories.length} categorie selezionate`}
                  </span>
                  <span className="text-[#78716C]">▾</span>
                </button>
                {categoryPickerOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#E2DDD5] shadow-lg p-2" data-testid="admin-rate-categories-list">
                    <div className="flex justify-between mb-1 px-1">
                      <button type="button" className="text-xs text-[#C05A3E] hover:underline" onClick={() => setRateForm((f) => ({ ...f, categories: [...collectionsList] }))}>Seleziona tutte</button>
                      <button type="button" className="text-xs text-[#78716C] hover:underline" onClick={() => setRateForm((f) => ({ ...f, categories: [] }))}>Deseleziona</button>
                    </div>
                    {collectionsList.map((c) => (
                      <label key={c} className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-[#F1EEE8] cursor-pointer">
                        <input type="checkbox" checked={rateForm.categories.includes(c)} onChange={() => toggleRateCategory(c)} className="accent-[#C05A3E]" />
                        {c}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-[#78716C] block mb-1">Fascia di peso</label>
                <select className={inputCls} value={rateForm.weight_bracket_id} onChange={(e) => setRateForm((f) => ({ ...f, weight_bracket_id: e.target.value }))}>
                  <option value="">Seleziona…</option>
                  {brackets.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-[#78716C] block mb-1">Prezzo (€)</label>
                  <input type="number" step="0.01" className={inputCls} value={rateForm.price} onChange={(e) => setRateForm((f) => ({ ...f, price: e.target.value }))} data-testid="admin-rate-price" />
                </div>
                <button type="submit" data-testid="admin-rate-save" className="bg-[#C05A3E] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors h-fit self-end">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="flex gap-3 mb-3">
              <select className={inputCls + " max-w-[220px]"} value={rateFilter.shipping_option_id} onChange={(e) => setRateFilter((f) => ({ ...f, shipping_option_id: e.target.value }))}>
                <option value="">Tutti i metodi</option>
                {shippingMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
              <select className={inputCls + " max-w-[220px]"} value={rateFilter.collection} onChange={(e) => setRateFilter((f) => ({ ...f, collection: e.target.value }))}>
                <option value="">Tutte le categorie</option>
                {collectionsList.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

            <div className="overflow-x-auto bg-white border border-[#E2DDD5]">
              <table className="w-full text-sm" data-testid="admin-rate-table">
                <thead className="bg-[#F1EEE8] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Metodo</th>
                    <th className="px-4 py-3 font-medium">Regione</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Fascia di peso</th>
                    <th className="px-4 py-3 font-medium">Prezzo</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((r) => (
                    <tr key={r.id} className="border-t border-[#E2DDD5]">
                      <td className="px-4 py-3">{methodLabel(r.shipping_option_id)}</td>
                      <td className="px-4 py-3">{r.region}</td>
                      <td className="px-4 py-3">{r.collection}</td>
                      <td className="px-4 py-3">{bracketLabel(r.weight_bracket_id)}</td>
                      <td className="px-4 py-3 font-medium">{eur(r.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteRate(r.id)} className="p-2 hover:bg-[#FBEAE5] rounded text-[#C05A3E]"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRates.length === 0 && <div className="p-8 text-center text-[#78716C]">Nessuna tariffa configurata.</div>}
            </div>
          </section>
        </div>
      )}

      {/* Weight bracket editor modal */}
      {editingBracket && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setEditingBracket(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveBracket}
            className="bg-[#F8F6F2] w-full max-w-md p-6" data-testid="admin-bracket-form">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif-display text-2xl">{editingBracket === "new" ? "Nuova fascia di peso" : "Modifica fascia di peso"}</h3>
              <button type="button" onClick={() => setEditingBracket(null)} className="p-2 hover:bg-[#F1EEE8] rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls + " col-span-2"} placeholder="Etichetta (es. 0-20 kg)" required
                value={bracketForm.label} onChange={(e) => setBracketForm((f) => ({ ...f, label: e.target.value }))} />
              <input className={inputCls} type="number" step="0.01" placeholder="Min kg" required
                value={bracketForm.min_kg} onChange={(e) => setBracketForm((f) => ({ ...f, min_kg: e.target.value }))} />
              <input className={inputCls} type="number" step="0.01" placeholder="Max kg (vuoto = oltre)"
                value={bracketForm.max_kg} onChange={(e) => setBracketForm((f) => ({ ...f, max_kg: e.target.value }))} />
              <input className={inputCls + " col-span-2"} type="number" placeholder="Ordine"
                value={bracketForm.order} onChange={(e) => setBracketForm((f) => ({ ...f, order: e.target.value }))} />
            </div>
            <button type="submit" className="w-full bg-[#C05A3E] text-white py-3 text-sm font-semibold hover:bg-[#A64B32] transition-colors mt-5">
              Salva fascia
            </button>
          </form>
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
              <input className={inputCls} type="number" step="1" placeholder="Pezzi per confezione" value={form.coverage_sqm} onChange={setF("coverage_sqm")} />
              <input className={inputCls} type="number" placeholder="Stock" value={form.stock} onChange={setF("stock")} />
              <input className={inputCls + " col-span-2"} placeholder="URL immagine 1 (foto principale)" value={form.image} onChange={setF("image")} data-testid="pf-image" />
              <input className={inputCls + " col-span-2"} placeholder="URL immagine 2 (opzionale)" value={form.image2} onChange={setF("image2")} data-testid="pf-image2" />
              <input className={inputCls + " col-span-2"} placeholder="URL immagine 3 (opzionale)" value={form.image3} onChange={setF("image3")} data-testid="pf-image3" />
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
