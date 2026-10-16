// Dati e funzioni SEO condivisi tra lo store (React) e lo script che, dopo la
// build, crea le pagine già pronte per Google (scripts/prerender.mjs).
// Nessun import: deve funzionare sia nel bundle sia in Node.

export const SITE_ORIGIN = "https://ceramicaincontro.it";
export const SITE_BASE = "/store";
export const SITE_URL = SITE_ORIGIN + SITE_BASE;
export const SITE_NAME = "Ceramica Incontro";
export const BRAND = "Ceramica Incontro";

export const DEFAULT_DESCRIPTION =
  "Negozio online Ceramica Incontro: battiscopa e rivestimenti in ceramica prodotti a Corato dal 1976. Spedizione in tutta Italia.";
export const DEFAULT_IMAGE = SITE_URL + "/img/hero.jpg";

/** Pagine pubbliche fisse: titolo (null = solo nome del sito) e descrizione. */
export const PAGE_META = {
  "/": { title: null, description: DEFAULT_DESCRIPTION },
  "/prodotti": {
    title: "Prodotti",
    description: "Catalogo Ceramica Incontro: battiscopa in ceramica 8x33 e linea SMUSSO con taglio a 30°. Prezzi a confezione e spedizione in tutta Italia.",
  },
  "/campioni": {
    title: "Campioni",
    description: "Richiedi fino a 3 campioni di battiscopa Ceramica Incontro prima di acquistare: i campioni sono gratuiti, paghi solo 6 € di spedizione.",
  },
  "/preventivo-progetto": {
    title: "Preventivo Progetto",
    description: "Preventivi dedicati per architetti, imprese e rivenditori: raccontaci il tuo progetto e ricevi un'offerta su misura da Ceramica Incontro.",
  },
  "/faq": {
    title: "Domande frequenti",
    description: "Spedizioni, pagamenti, fattura, resi, campioni e ordini: le risposte alle domande più frequenti sul negozio online Ceramica Incontro.",
  },
  "/privacy": { title: "Informativa sulla privacy", description: "Informativa sul trattamento dei dati personali del negozio online Ceramica Incontro." },
  "/cookie": { title: "Cookie policy", description: "Cookie e memorizzazione tecnica usati dal negozio online Ceramica Incontro." },
  "/condizioni-di-vendita": { title: "Condizioni generali di vendita", description: "Condizioni generali di vendita del negozio online Ceramica Incontro: prezzi, pagamento, spedizione, recesso e garanzia." },
  "/recesso": { title: "Diritto di recesso", description: "Come esercitare il diritto di recesso entro 14 giorni sugli acquisti del negozio online Ceramica Incontro, con il modulo." },
  "/note-legali": { title: "Note legali", description: "Dati societari e note legali di Ceramica Incontro S.r.l." },
  "/accessibilita": { title: "Dichiarazione di accessibilità", description: "Dichiarazione di accessibilità del negozio online Ceramica Incontro." },
  "/assistente-ia": { title: "Assistente IA «Glaze»", description: "Come funziona Glaze, l'assistente automatico del negozio online Ceramica Incontro, e come tratta i dati." },
};

/** Pagine private o di servizio: non devono finire su Google. */
const NOINDEX_PREFIXES = ["/checkout", "/account", "/admin", "/login", "/register", "/payment", "/ordine", "/recedi"];
export const isNoindexPath = (path) =>
  NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

export const fullTitle = (title) => (title ? `${title} | ${SITE_NAME}` : SITE_NAME);

/** Indirizzo "ufficiale" della pagina, senza parametri e senza "/" finale. */
export const canonicalUrl = (path) => {
  const clean = (path || "/").split(/[?#]/)[0].replace(/\/+$/, "");
  return SITE_URL + (clean || "/");
};

export const productPath = (p) => `/prodotto/${p.id}`;

/** Codice articolo dal nome, es. "Battiscopa 8x33 - 33A002" → "33A002". */
export const productCode = (p) => {
  const m = /\s-\s([A-Z0-9]+)\s*$/.exec(p.name || "");
  return m ? m[1] : null;
};

const clip = (text, max = 160) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "") + "…";
};

export const productDescription = (p) => {
  const base = (p.description || p.name || "").trim().replace(/\.$/, "");
  const specs = [
    p.format && `formato ${p.format}`,
    p.finish && `finitura ${p.finish}`,
    p.color && `colore ${p.color}`,
  ].filter(Boolean).join(", ");
  return clip(`${base}. ${specs ? specs.charAt(0).toUpperCase() + specs.slice(1) + ". " : ""}Ceramica Incontro, spedizione in tutta Italia.`);
};

export const priceWithVat = (price, vatRate) => Math.round(price * (1 + vatRate / 100) * 100) / 100;

/** Dati prodotto per Google (schema.org Product). Prezzo IVA inclusa, disponibilità non indicata. */
export const productJsonLd = (p, vatRate = 22) => {
  const url = canonicalUrl(productPath(p));
  const images = [p.image, ...(p.gallery || [])].filter(Boolean);
  const code = productCode(p);
  const gross = priceWithVat(Number(p.price) || 0, vatRate).toFixed(2);
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: productDescription(p),
    url,
    brand: { "@type": "Brand", name: BRAND },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: gross,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: gross,
        priceCurrency: "EUR",
        valueAddedTaxIncluded: true,
      },
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Ceramica Incontro S.r.l." },
    },
  };
  if (images.length) data.image = images;
  if (code) { data.sku = code; data.mpn = code; }
  if (p.collection) data.category = p.collection;
  return data;
};

/**
 * Testo delle FAQ: **grassetto** e [testo](/percorso o mailto:...).
 * Restituisce una lista di pezzi { type: "text" | "bold" | "link", text, href }.
 */
export const parseInline = (text) => {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else out.push({ type: "link", text: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
};

/** Testo semplice di una risposta FAQ (per la descrizione e i controlli). */
export const faqAnswerText = (blocks) =>
  blocks
    .map((b) => (typeof b === "string" ? [b] : b.list))
    .flat()
    .map((t) => parseInline(t).map((x) => x.text).join(""))
    .join(" ");
