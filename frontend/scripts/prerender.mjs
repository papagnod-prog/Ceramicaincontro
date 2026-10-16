// Dopo la build crea le pagine "già pronte" per Google e la sitemap.
//
// - build/app.html            copia della pagina vuota originale: l'.htaccess la
//                             usa per tutte le pagine senza versione pronta
//                             (checkout, account, admin, …).
// - build/index.html          home, con titolo, descrizione e testo base.
// - build/<pagina>.html       pagine pubbliche fisse (prodotti, FAQ, legali, …).
// - build/prodotto/<id>.html  una per prodotto, con i dati per Google.
// - build/sitemap.xml
//
// I prodotti vengono letti dal server (Render). Se il server dorme, lo script
// aspetta e riprova; se non risponde, la build fallisce invece di pubblicare
// pagine incomplete.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_META, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SITE_NAME, SITE_URL, SITE_BASE,
  canonicalUrl, fullTitle, productPath, productDescription, productJsonLd,
  priceWithVat, parseInline,
} from "../src/lib/seo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "build");
const faq = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/faq.json"), "utf8"));

const backendUrl = () => {
  if (process.env.PRERENDER_API_URL) return process.env.PRERENDER_API_URL.replace(/\/$/, "");
  const env = fs.readFileSync(path.join(ROOT, ".env.production"), "utf8");
  const m = /^REACT_APP_BACKEND_URL=(.+)$/m.exec(env);
  if (!m) throw new Error("REACT_APP_BACKEND_URL non trovato in .env.production");
  return m[1].trim().replace(/\/$/, "") + "/api";
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 6) {
  let lastErr;
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.log(`  ${url}: tentativo ${i}/${tries} fallito (${e.message}), riprovo…`);
      await sleep(10_000);
    }
  }
  throw new Error(`Server non raggiungibile: ${url} (${lastErr?.message})`);
}

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const href = (h) => (h.startsWith("/") ? SITE_BASE + h : h);
const inlineHtml = (text) => parseInline(text).map((t) => {
  if (t.type === "bold") return `<strong>${esc(t.text)}</strong>`;
  if (t.type === "link") return `<a href="${esc(href(t.href))}">${esc(t.text)}</a>`;
  return esc(t.text);
}).join("");
const eur = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

// Se lo script viene rilanciato sulla stessa build, index.html è già la home
// pronta: in quel caso la pagina vuota originale è app.html.
const indexHtml = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
const template = indexHtml.includes('data-prerender="1"')
  ? fs.readFileSync(path.join(BUILD, "app.html"), "utf8")
  : indexHtml;
if (!/<div id="root"><\/div>/.test(template) || !/<title>[^<]*<\/title>/.test(template)) {
  throw new Error("build/index.html non ha la forma attesa (title / div#root)");
}

function page({ route, title, description, image = DEFAULT_IMAGE, ogType = "website", jsonLd, body }) {
  const t = fullTitle(title);
  const url = canonicalUrl(route);
  const head = [
    `<link rel="canonical" href="${esc(url)}"/>`,
    `<meta name="robots" content="index, follow"/>`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}"/>`,
    `<meta property="og:locale" content="it_IT"/>`,
    `<meta property="og:type" content="${ogType}"/>`,
    `<meta property="og:title" content="${esc(t)}"/>`,
    `<meta property="og:description" content="${esc(description)}"/>`,
    `<meta property="og:url" content="${esc(url)}"/>`,
    `<meta property="og:image" content="${esc(image)}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    jsonLd ? `<script type="application/ld+json" id="ld-json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : "",
  ].join("");
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(t)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}"/>`)
    .replace("</head>", head + "</head>")
    .replace('<div id="root"></div>', `<div id="root"><div class="max-w-5xl mx-auto px-4 py-12" data-prerender="1">${body}</div></div>`);
  if (!html.includes(`content="${esc(description)}"`)) throw new Error(`descrizione non inserita in ${route}`);
  return html;
}

// /faq → build/faq.html, /prodotto/<id> → build/prodotto/<id>.html (home → index.html).
// File e non cartelle: così Apache non aggiunge la "/" finale con un redirect.
function write(route, html) {
  const file = route === "/" ? path.join(BUILD, "index.html") : path.join(BUILD, route + ".html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const nav = `<nav aria-label="Negozio"><a href="${SITE_BASE}/">Home</a> · <a href="${SITE_BASE}/prodotti">Prodotti</a> · <a href="${SITE_BASE}/campioni">Campioni</a> · <a href="${SITE_BASE}/preventivo-progetto">Preventivi Progetto</a> · <a href="${SITE_BASE}/faq">Domande frequenti</a></nav>`;

async function main() {
  const api = backendUrl();
  console.log(`Prerender: leggo i prodotti da ${api}`);
  const products = await getJson(`${api}/products`);
  if (!Array.isArray(products) || products.length === 0) throw new Error("Nessun prodotto ricevuto dal server");
  const vat = await getJson(`${api}/vat`);
  const vatRate = typeof vat?.vat_rate_products === "number" ? vat.vat_rate_products : 22;

  // Pagina vuota originale, per le pagine senza versione pronta.
  fs.writeFileSync(path.join(BUILD, "app.html"), template);

  const byCollection = {};
  products.forEach((p) => { (byCollection[p.collection || "Altro"] ||= []).push(p); });
  const productLinks = Object.entries(byCollection).map(([c, list]) =>
    `<h2>${esc(c)}</h2><ul>${list.map((p) => `<li><a href="${SITE_BASE}${productPath(p)}">${esc(p.name)}</a></li>`).join("")}</ul>`).join("");

  // Pagine fisse
  const bodies = {
    "/": `<h1>${esc(SITE_NAME)}: l'innovazione del battiscopa</h1><p>${esc(DEFAULT_DESCRIPTION)}</p>${nav}`,
    "/prodotti": `<h1>Prodotti</h1><p>${esc(PAGE_META["/prodotti"].description)}</p>${productLinks}`,
    "/faq": `<h1>Domande frequenti</h1>${faq.sections.map((s) => `<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>${s.items.map((it) =>
      `<h3>${esc(it.q)}</h3>${it.a.map((b) => (typeof b === "string" ? `<p>${inlineHtml(b)}</p>` : `<ul>${b.list.map((li) => `<li>${inlineHtml(li)}</li>`).join("")}</ul>`)).join("")}`).join("")}</section>`).join("")}`,
  };
  const staticRoutes = Object.keys(PAGE_META);
  for (const route of staticRoutes) {
    const m = PAGE_META[route];
    write(route, page({
      route, title: m.title, description: m.description,
      body: bodies[route] || `<h1>${esc(m.title || SITE_NAME)}</h1><p>${esc(m.description)}</p>${nav}`,
    }));
  }

  // Prodotti
  for (const p of products) {
    const desc = productDescription(p);
    const specs = [["Collezione", p.collection], ["Formato", p.format], ["Finitura", p.finish], ["Colore", p.color],
      ["Utilizzo", p.usage], ["Peso", p.weight_kg != null ? `${p.weight_kg} kg / cf` : null],
      ["Pezzi per confezione", p.coverage_sqm != null ? `${p.coverage_sqm}` : null]].filter(([, v]) => v);
    const body = `<nav aria-label="Percorso"><a href="${SITE_BASE}/">Home</a> › <a href="${SITE_BASE}/prodotti">Prodotti</a> › ${esc(p.name)}</nav>`
      + `<h1>${esc(p.name)}</h1>`
      + (p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="max-width:100%;max-height:380px;object-fit:contain"/>` : "")
      + `<p>${esc(p.description || "")}</p>`
      + `<p><strong>${esc(eur(p.price))}</strong> a confezione, IVA esclusa (${esc(eur(priceWithVat(p.price, vatRate)))} IVA inclusa)</p>`
      + `<ul>${specs.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("")}</ul>`
      + `<p><a href="${SITE_BASE}/prodotti">Torna al negozio</a></p>`;
    write(productPath(p), page({
      route: productPath(p), title: p.name, description: desc, image: p.image || DEFAULT_IMAGE,
      ogType: "product", jsonLd: productJsonLd(p, vatRate), body,
    }));
  }

  // Sitemap
  const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
  const urls = [
    ...staticRoutes.map((r) => ({ loc: canonicalUrl(r) })),
    ...products.map((p) => ({ loc: canonicalUrl(productPath(p)), lastmod: day(p.updated_at || p.created_at) })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(BUILD, "sitemap.xml"), xml);

  console.log(`Prerender: ${staticRoutes.length} pagine fisse, ${products.length} prodotti, sitemap con ${urls.length} indirizzi (${SITE_URL}/sitemap.xml).`);
}

main().catch((e) => {
  console.error(`Prerender FALLITO: ${e.message}`);
  process.exit(1);
});
