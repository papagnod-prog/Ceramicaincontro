import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { STORE_COLLECTIONS } from "@/lib/collections";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shop/ProductCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

const FINISHES = ["all", "Matt", "Lucido", "Naturale", "Strutturato", "Antiscivolo R11"];

export default function Catalog() {
  usePageTitle("Prodotti");
  const [params, setParams] = useSearchParams();
  const collections = STORE_COLLECTIONS;

  // Collezioni non più mostrate (vecchi link) ricadono su "Tutte".
  const rawCollection = params.get("collection") || "all";
  const collection = collections.includes(rawCollection) ? rawCollection : "all";
  const finish = params.get("finish") || "all";
  const sort = params.get("sort") || "featured";
  const search = (params.get("search") || "").trim();

  const [term, setTerm] = useState(search);
  useEffect(() => { setTerm(search); }, [search]);

  const productsQuery = useProducts({ collection, finish, sort, search });
  const products = productsQuery.data ?? [];
  const loading = productsQuery.isLoading;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key === "collection" && rawCollection !== collection && (!value || value === "all")) next.delete("collection");
    setParams(next);
  };

  // Ricerca mentre si digita (con breve attesa) oltre all'invio da tastiera.
  useEffect(() => {
    const t = term.trim();
    if (t === search) return;
    const id = setTimeout(() => setParam("search", t), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const submitSearch = (e) => {
    e.preventDefault();
    setParam("search", term.trim());
    e.currentTarget.querySelector("input")?.blur();
  };

  return (
    <div data-testid="catalog-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <p className="eyebrow text-[#C05A3E] mb-2">Negozio</p>
        <h1 className="font-serif-display text-4xl lg:text-5xl font-light">
          {collection !== "all" ? collection : "Tutte le collezioni"}
        </h1>
        {search && <p data-testid="search-summary" className="text-sm text-[#78716C] mt-2">Risultati per "{search}"</p>}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters */}
        <aside className="lg:w-56 shrink-0 space-y-6">
          <form onSubmit={submitSearch}>
            <label htmlFor="catalog-search" className="eyebrow block mb-2">Cerca</label>
            <div className="relative flex items-center">
              <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
              <input
                id="catalog-search"
                aria-label="Cerca per nome o codice"
                data-testid="catalog-search-input"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nome o codice"
                className="pl-9 pr-9 h-10 w-full bg-white border border-[#E2DDD5] rounded-md text-base sm:text-sm focus:outline-none focus:border-[#C05A3E] [&::-webkit-search-cancel-button]:hidden"
              />
              {term && (
                <button
                  type="button"
                  data-testid="catalog-search-clear"
                  onClick={() => { setTerm(""); setParam("search", ""); }}
                  className="absolute right-2 p-1 text-[#78716C] hover:text-[#1C1917]"
                  aria-label="Cancella ricerca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
          <div>
            <label htmlFor="catalog-collezione" className="eyebrow block mb-2">Collezione</label>
            <Select value={collection} onValueChange={(v) => setParam("collection", v)}>
              <SelectTrigger id="catalog-collezione" data-testid="filter-collection-select" className="bg-white border-[#E2DDD5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Tutte</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="catalog-finitura" className="eyebrow block mb-2">Finitura</label>
            <Select value={finish} onValueChange={(v) => setParam("finish", v)}>
              <SelectTrigger id="catalog-finitura" data-testid="filter-finish-select" className="bg-white border-[#E2DDD5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {FINISHES.map((f) => (
                  <SelectItem key={f} value={f}>{f === "all" ? "Tutte" : f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="catalog-ordina-per" className="eyebrow block mb-2">Ordina per</label>
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger id="catalog-ordina-per" data-testid="filter-sort-select" className="bg-white border-[#E2DDD5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="featured">In evidenza</SelectItem>
                <SelectItem value="price_asc">Prezzo crescente</SelectItem>
                <SelectItem value="price_desc">Prezzo decrescente</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          {!loading && !productsQuery.isError && (
            <p data-testid="catalog-count" className="text-sm text-[#78716C] mb-5" aria-live="polite">
              {products.length === 1 ? "1 prodotto" : `${products.length} prodotti`}
              {productsQuery.isFetching && " · aggiornamento…"}
            </p>
          )}
          {productsQuery.isError ? (
            <div data-testid="catalog-error" className="text-center py-24 text-[#57534E]">
              <p className="mb-4">Non è stato possibile caricare i prodotti.</p>
              <button
                onClick={() => productsQuery.refetch()}
                className="bg-[#C05A3E] text-white px-6 py-3 text-sm font-semibold hover:bg-[#A64B32] transition-colors"
              >
                Riprova
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-[#F1EEE8] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div data-testid="catalog-empty" className="text-center py-24 text-[#78716C]">
              <p>Nessun prodotto trovato{search ? ` per "${search}"` : ""}.</p>
              {(search || collection !== "all" || finish !== "all") && (
                <button
                  onClick={() => setParams(new URLSearchParams())}
                  className="mt-4 text-[#C05A3E] font-medium ci-link-underline"
                >
                  Mostra tutti i prodotti
                </button>
              )}
            </div>
          ) : (
            <div data-testid="product-catalog-grid" className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
