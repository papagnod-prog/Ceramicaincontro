import { useEffect, useMemo, useState } from "react";
import { STORE_COLLECTIONS } from "@/lib/collections";
import { Link, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  LayoutGrid, Package, ClipboardList, Plus, Pencil, Trash2, X, ArrowLeft, Beaker, FileText, Truck, Search,
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
  const [aiUse, setAiUse] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState("loading"); // loading | ready | error
  const [productSearch, setProductSearch] = useState("");
  const [productCollection, setProductCollection] = useState("all");
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
  const [rateFilter, setRateFilter] = useState({ shipping_option_id: "", collection: "", region: "" });

  // Payment settings (IBAN bonifico + chiavi Stripe/PayPal)
  const [paymentSettings, setPaymentSettings] = useState({
    bank_transfer_iban: "", bank_transfer_holder: "", bank_transfer_bic: "",
    stripe_publishable_key: "", stripe_secret_key: "", paypal_client_id: "", paypal_secret: "",
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login");
  }, [loading, user, navigate]);

  const loadAll = () => {
    api.get("/admin/assistant/usage").then(({ data }) => setAiUse(data)).catch(() => {});
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/products")
      .then(({ data }) => { setProducts(data); setProductsStatus("ready"); })
      .catch(() => setProductsStatus("error"));
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
    api.get("/admin/payment-settings").then(({ data }) => setPaymentSettings(data)).catch(() => {});
  };
  useEffect(() => {
    if (user?.role === "admin") { loadAll(); loadShipping(); }
  }, [user]);

  // Ricerca per nome/codice e filtro collezione, combinabili.
  const filteredProducts = useMemo(() => {
    const terms = productSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (productCollection !== "all" && p.collection !== productCollection) return false;
      if (!terms.length) return true;
      const hay = `${p.name || ""} ${p.id || ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [products, productSearch, productCollection]);
  const productFiltersActive = productSearch.trim() !== "" || productCollection !== "all";

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
      await api.put("/admin/shipping/unloading-service", { price: 0, label: unloading.label || "Consegna a piano strada" });
      toast.success("Servizio di scarico salvato");
      loadShipping();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  // --- Payment settings (IBAN bonifico + chiavi Stripe/PayPal) ---
  const savePaymentSettings = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put("/admin/payment-settings", paymentSettings);
      setPaymentSettings(data);
      toast.success("Impostazioni di pagamento salvate");
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
      (!rateFilter.collection || r.collection === rateFilter.collection) &&
      (!rateFilter.region || r.region === rateFilter.region)
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
      {tab === "dashboard" && aiUse && (
        <p className="text-sm mb-4" data-testid="admin-ai-usage">Assistente Glaze: {aiUse.enabled ? "attivo" : "spento"} · mese ${aiUse.month_usd} / ${aiUse.monthly_cap_usd} · oggi ${aiUse.day_usd} / ${aiUse.daily_cap_usd} · {aiUse.calls_month} chiamate{aiUse.over_cap ? " · TETTO RAGGIUNTO" : ""}</p>
      )}
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
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4" data-testid="admin-product-filters">
            <div className="flex-1 sm:max-w-sm">
              <label htmlFor="admin-product-search" className="block text-xs font-medium text-[#57534E] mb-1.5">Cerca prodotto</label>
              <div className="relative flex items-center">
                <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
                <input
                  id="admin-product-search"
                  aria-label="Cerca prodotto per nome o codice"
                  data-testid="admin-product-search"
                  type="search"
                  autoComplete="off"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Nome o codice, es. 60SP009"
                  className="w-full h-10 pl-9 pr-3 bg-white border border-[#E2DDD5] text-sm focus:outline-none focus:border-[#C05A3E]"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <label htmlFor="admin-product-collection" className="block text-xs font-medium text-[#57534E] mb-1.5">Collezione</label>
              <Select value={productCollection} onValueChange={setProductCollection}>
                <SelectTrigger id="admin-product-collection" data-testid="admin-product-collection" aria-label="Filtra per collezione" className="bg-white border-[#E2DDD5] rounded-none h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Tutte</SelectItem>
                  {STORE_COLLECTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {productFiltersActive && (
              <button
                type="button"
                data-testid="admin-product-filters-reset"
                onClick={() => { setProductSearch(""); setProductCollection("all"); }}
                className="h-10 px-3 text-sm text-[#C05A3E] hover:text-[#A64B32] ci-link-underline self-start sm:self-end"
              >
                Azzera filtri
              </button>
            )}
          </div>
          <div className="flex justify-between items-center mb-5">
            <p className="text-sm text-[#78716C]" data-testid="admin-product-count" aria-live="polite">
              {productFiltersActive ? `${filteredProducts.length} di ${products.length} prodotti` : `${products.length} prodotti`}
            </p>
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
                  <th className="px-4 py-3"><span className="sr-only">Azioni</span></th>
                </tr>
              </thead>
              <tbody>
                {productsStatus === "loading" && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[#78716C]">Caricamento prodotti…</td></tr>
                )}
                {productsStatus === "error" && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[#57534E]">
                    Impossibile caricare i prodotti.{" "}
                    <button onClick={loadAll} className="text-[#C05A3E] font-medium ci-link-underline">Riprova</button>
                  </td></tr>
                )}
                {productsStatus === "ready" && filteredProducts.length === 0 && (
                  <tr><td colSpan={5} data-testid="admin-product-empty" className="px-4 py-8 text-center text-[#78716C]">
                    Nessun prodotto corrisponde ai filtri.
                  </td></tr>
                )}
                {filteredProducts.map((p) => (
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
                <tr
                  key={o.id}
                  data-testid={`order-row-${o.id}`}
                  className="border-t border-[#E2DDD5] cursor-pointer hover:bg-[#F8F6F2]"
                  onClick={(e) => {
                    if (e.target.closest?.("input, button, select, [role=option], [role=listbox], [role=combobox]")) return;
                    navigate(`/admin/ordini/${o.id}`);
                  }}
                >
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
                      <SelectTrigger aria-label="Stato ordine" data-testid={`order-status-${o.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {STATUS_OPTS.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input aria-label="Cod. tracking"
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
                      <SelectTrigger aria-label="Stato campione" data-testid={`sample-status-${s.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {SAMPLE_STATUS_OPTS.map((st) => (<SelectItem key={st} value={st}>{SAMPLE_STATUS_LABEL[st]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input aria-label="Cod. tracking"
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
                      <SelectTrigger aria-label="Stato preventivo" data-testid={`quote-status-${q.id}`} className="h-9 bg-white border-[#E2DDD5]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {QUOTE_STATUS_OPTS.map((st) => (<SelectItem key={st} value={st}>{QUOTE_STATUS_LABEL[st]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <input aria-label="Importo preventivo"
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
                    <th className="px-4 py-3"><span className="sr-only">Azioni</span></th>
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
                <label htmlFor="admin-iva-prodotti" className="text-xs text-[#78716C] block mb-1">IVA prodotti (%)</label>
                <input id="admin-iva-prodotti" aria-label="IVA prodotti (%)" type="number" step="0.01" min="0" max="100" className={inputCls}
                  value={vatRates.vat_rate_products}
                  onChange={(e) => setVatRates((v) => ({ ...v, vat_rate_products: e.target.value }))}
                  data-testid="admin-vat-products" />
              </div>
              <div>
                <label htmlFor="admin-iva-trasporto" className="text-xs text-[#78716C] block mb-1">IVA trasporto (%)</label>
                <input id="admin-iva-trasporto" aria-label="IVA trasporto (%)" type="number" step="0.01" min="0" max="100" className={inputCls}
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
            <h3 className="font-serif-display text-2xl mb-4">Consegna a piano strada (sponda idraulica + trans pallet)</h3>
            <form onSubmit={saveUnloading} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-[1fr_auto] gap-3 items-end" data-testid="admin-unloading-form">
              <div>
                <label htmlFor="admin-etichetta" className="text-xs text-[#78716C] block mb-1">Etichetta</label>
                <input id="admin-etichetta" aria-label="Etichetta" className={inputCls} value={unloading.label} onChange={(e) => setUnloading((u) => ({ ...u, label: e.target.value }))} />
              </div>
              <button type="submit" className="bg-[#C05A3E] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors h-fit">Salva</button>
            </form>
            <p className="text-xs text-[#78716C] mt-2">Servizio sempre incluso, senza costo aggiuntivo. La consegna è tassativamente al piano strada. Visibile in checkout solo quando si seleziona la spedizione con corriere.</p>
          </section>

          {/* Payment settings: IBAN bonifico + chiavi Stripe/PayPal */}
          <section>
            <h3 className="font-serif-display text-2xl mb-4">Pagamenti</h3>
            <form onSubmit={savePaymentSettings} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-3 gap-3 items-end" data-testid="admin-payment-settings-form">
              <div className="sm:col-span-3 text-sm font-medium text-[#57534E] -mb-1">Bonifico bancario</div>
              <div>
                <label htmlFor="admin-iban" className="text-xs text-[#78716C] block mb-1">IBAN</label>
                <input id="admin-iban" aria-label="IBAN" className={inputCls} value={paymentSettings.bank_transfer_iban} onChange={(e) => setPaymentSettings((p) => ({ ...p, bank_transfer_iban: e.target.value }))} data-testid="admin-payment-iban" />
              </div>
              <div>
                <label htmlFor="admin-titolare-conto" className="text-xs text-[#78716C] block mb-1">Titolare conto</label>
                <input id="admin-titolare-conto" aria-label="Titolare conto" className={inputCls} value={paymentSettings.bank_transfer_holder} onChange={(e) => setPaymentSettings((p) => ({ ...p, bank_transfer_holder: e.target.value }))} data-testid="admin-payment-holder" />
              </div>
              <div>
                <label htmlFor="admin-bic-swift" className="text-xs text-[#78716C] block mb-1">BIC/SWIFT</label>
                <input id="admin-bic-swift" aria-label="BIC/SWIFT" className={inputCls} value={paymentSettings.bank_transfer_bic} onChange={(e) => setPaymentSettings((p) => ({ ...p, bank_transfer_bic: e.target.value }))} data-testid="admin-payment-bic" />
              </div>
              <div className="sm:col-span-3 text-sm font-medium text-[#57534E] mt-3 -mb-1">Stripe (informativo: la chiave attiva è la variabile STRIPE_SECRET_KEY sul server)</div>
              <div>
                <label htmlFor="admin-publishable-key" className="text-xs text-[#78716C] block mb-1">Publishable key</label>
                <input id="admin-publishable-key" aria-label="Publishable key" className={inputCls} value={paymentSettings.stripe_publishable_key} onChange={(e) => setPaymentSettings((p) => ({ ...p, stripe_publishable_key: e.target.value }))} data-testid="admin-stripe-publishable" />
              </div>
              <div>
                <label htmlFor="admin-secret-key" className="text-xs text-[#78716C] block mb-1">Secret key</label>
                <input id="admin-secret-key" aria-label="Secret key" type="password" className={inputCls} value={paymentSettings.stripe_secret_key} onChange={(e) => setPaymentSettings((p) => ({ ...p, stripe_secret_key: e.target.value }))} data-testid="admin-stripe-secret" />
              </div>
              <div className="sm:col-span-3 text-sm font-medium text-[#57534E] mt-3 -mb-1">PayPal (chiavi salvate, non ancora attivo in checkout)</div>
              <div>
                <label htmlFor="admin-client-id" className="text-xs text-[#78716C] block mb-1">Client ID</label>
                <input id="admin-client-id" aria-label="Client ID" className={inputCls} value={paymentSettings.paypal_client_id} onChange={(e) => setPaymentSettings((p) => ({ ...p, paypal_client_id: e.target.value }))} data-testid="admin-paypal-client-id" />
              </div>
              <div>
                <label htmlFor="admin-secret" className="text-xs text-[#78716C] block mb-1">Secret</label>
                <input id="admin-secret" aria-label="Secret" type="password" className={inputCls} value={paymentSettings.paypal_secret} onChange={(e) => setPaymentSettings((p) => ({ ...p, paypal_secret: e.target.value }))} data-testid="admin-paypal-secret" />
              </div>
              <div className="sm:col-span-3">
                <button type="submit" className="bg-[#C05A3E] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#A64B32] transition-colors">Salva impostazioni di pagamento</button>
              </div>
            </form>
            <p className="text-xs text-[#78716C] mt-2">Il pagamento con carta si attiva impostando STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET sul server (Render). PayPal non è attivo.</p>
          </section>

          {/* Rates matrix */}
          <section>
            <h3 className="font-serif-display text-2xl mb-4">Tariffe per regione, peso e categoria</h3>
            <form onSubmit={saveRate} className="bg-white border border-[#E2DDD5] p-5 grid sm:grid-cols-5 gap-3 items-end mb-5" data-testid="admin-rate-form">
              <div>
                <label htmlFor="admin-metodo" className="text-xs text-[#78716C] block mb-1">Metodo</label>
                <select id="admin-metodo" aria-label="Metodo" className={inputCls} value={rateForm.shipping_option_id} onChange={(e) => setRateForm((f) => ({ ...f, shipping_option_id: e.target.value }))}>
                  <option value="">Seleziona…</option>
                  {shippingMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div className="relative">
                <label htmlFor="admin-rate-regions-toggle" className="text-xs text-[#78716C] block mb-1">Regioni</label>
                <button
                  id="admin-rate-regions-toggle"
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
                        <input type="checkbox" aria-label={r} checked={rateForm.regions.includes(r)} onChange={() => toggleRateRegion(r)} className="accent-[#C05A3E]" />
                        {r}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label htmlFor="admin-rate-categories-toggle" className="text-xs text-[#78716C] block mb-1">Categorie</label>
                <button
                  id="admin-rate-categories-toggle"
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
                        <input type="checkbox" aria-label={c} checked={rateForm.categories.includes(c)} onChange={() => toggleRateCategory(c)} className="accent-[#C05A3E]" />
                        {c}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="admin-fascia-di-peso" className="text-xs text-[#78716C] block mb-1">Fascia di peso</label>
                <select id="admin-fascia-di-peso" aria-label="Fascia di peso" className={inputCls} value={rateForm.weight_bracket_id} onChange={(e) => setRateForm((f) => ({ ...f, weight_bracket_id: e.target.value }))}>
                  <option value="">Seleziona…</option>
                  {brackets.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="admin-prezzo" className="text-xs text-[#78716C] block mb-1">Prezzo (€)</label>
                  <input id="admin-prezzo" aria-label="Prezzo (€)" type="number" step="0.01" className={inputCls} value={rateForm.price} onChange={(e) => setRateForm((f) => ({ ...f, price: e.target.value }))} data-testid="admin-rate-price" />
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
              <select className={inputCls + " max-w-[220px]"} value={rateFilter.region} onChange={(e) => setRateFilter((f) => ({ ...f, region: e.target.value }))} data-testid="admin-rate-filter-region">
                <option value="">Tutte le regioni</option>
                {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
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
                    <th className="px-4 py-3"><span className="sr-only">Azioni</span></th>
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
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={() => setEditingBracket(null)} />
          <form onSubmit={saveBracket}
            className="relative bg-[#F8F6F2] w-full max-w-md p-6" data-testid="admin-bracket-form">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif-display text-2xl">{editingBracket === "new" ? "Nuova fascia di peso" : "Modifica fascia di peso"}</h3>
              <button type="button" aria-label="Chiudi" onClick={() => setEditingBracket(null)} className="p-2 hover:bg-[#F1EEE8] rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input aria-label="Etichetta (es. 0-20 kg)" className={inputCls + " col-span-2"} placeholder="Etichetta (es. 0-20 kg)" required
                value={bracketForm.label} onChange={(e) => setBracketForm((f) => ({ ...f, label: e.target.value }))} />
              <input aria-label="Min kg" className={inputCls} type="number" step="0.01" placeholder="Min kg" required
                value={bracketForm.min_kg} onChange={(e) => setBracketForm((f) => ({ ...f, min_kg: e.target.value }))} />
              <input aria-label="Max kg (vuoto = oltre)" className={inputCls} type="number" step="0.01" placeholder="Max kg (vuoto = oltre)"
                value={bracketForm.max_kg} onChange={(e) => setBracketForm((f) => ({ ...f, max_kg: e.target.value }))} />
              <input aria-label="Ordine" className={inputCls + " col-span-2"} type="number" placeholder="Ordine"
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
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={() => setEditing(null)} />
          <form onSubmit={saveProduct}
            className="relative bg-[#F8F6F2] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" data-testid="admin-product-form">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif-display text-2xl">{editing === "new" ? "Nuovo prodotto" : "Modifica prodotto"}</h3>
              <button type="button" aria-label="Chiudi" onClick={() => setEditing(null)} className="p-2 hover:bg-[#F1EEE8] rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input aria-label="Nome" className={inputCls + " col-span-2"} placeholder="Nome" required value={form.name} onChange={setF("name")} data-testid="pf-name" />
              <input aria-label="Collezione" className={inputCls} placeholder="Collezione" required value={form.collection} onChange={setF("collection")} data-testid="pf-collection" />
              <input aria-label="Formato" className={inputCls} placeholder="Formato" value={form.format} onChange={setF("format")} data-testid="pf-format" />
              <input aria-label="Finitura" className={inputCls} placeholder="Finitura" value={form.finish} onChange={setF("finish")} />
              <input aria-label="Colore" className={inputCls} placeholder="Colore" value={form.color} onChange={setF("color")} />
              <input aria-label="Utilizzo" className={inputCls} placeholder="Utilizzo" value={form.usage} onChange={setF("usage")} />
              <input aria-label="Prezzo €" className={inputCls} type="number" step="0.01" placeholder="Prezzo €" required value={form.price} onChange={setF("price")} data-testid="pf-price" />
              <input aria-label="Peso kg" className={inputCls} type="number" step="0.01" placeholder="Peso kg" value={form.weight_kg} onChange={setF("weight_kg")} data-testid="pf-weight" />
              <input aria-label="Pezzi per confezione" className={inputCls} type="number" step="1" placeholder="Pezzi per confezione" value={form.coverage_sqm} onChange={setF("coverage_sqm")} />
              <input aria-label="Stock" className={inputCls} type="number" placeholder="Stock" value={form.stock} onChange={setF("stock")} />
              <input aria-label="URL immagine 1 (foto principale)" className={inputCls + " col-span-2"} placeholder="URL immagine 1 (foto principale)" value={form.image} onChange={setF("image")} data-testid="pf-image" />
              <input aria-label="URL immagine 2 (opzionale)" className={inputCls + " col-span-2"} placeholder="URL immagine 2 (opzionale)" value={form.image2} onChange={setF("image2")} data-testid="pf-image2" />
              <input aria-label="URL immagine 3 (opzionale)" className={inputCls + " col-span-2"} placeholder="URL immagine 3 (opzionale)" value={form.image3} onChange={setF("image3")} data-testid="pf-image3" />
              <textarea aria-label="Descrizione" className={inputCls + " col-span-2"} rows={3} placeholder="Descrizione" value={form.description} onChange={setF("description")} />
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="In evidenza in homepage" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="accent-[#C05A3E]" />
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
