import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { ProductCard } from "@/components/shop/ProductCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const FINISHES = ["all", "Matt", "Lucido", "Naturale", "Strutturato", "Antiscivolo R11"];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  const collection = params.get("collection") || "all";
  const finish = params.get("finish") || "all";
  const sort = params.get("sort") || "featured";
  const search = params.get("search") || "";

  useEffect(() => {
    api.get("/collections").then(({ data }) => setCollections(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (collection !== "all") qs.set("collection", collection);
    if (finish !== "all") qs.set("finish", finish);
    if (sort) qs.set("sort", sort);
    if (search) qs.set("search", search);
    api.get(`/products?${qs.toString()}`).then(({ data }) => {
      setProducts(data);
      setLoading(false);
    });
  }, [collection, finish, sort, search]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div data-testid="catalog-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <p className="eyebrow text-[#C05A3E] mb-2">Negozio</p>
        <h1 className="font-serif-display text-4xl lg:text-5xl font-light">
          {collection !== "all" ? collection : "Tutte le collezioni"}
        </h1>
        {search && <p className="text-sm text-[#78716C] mt-2">Risultati per "{search}"</p>}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters */}
        <aside className="lg:w-56 shrink-0 space-y-6">
          <div>
            <label className="eyebrow block mb-2">Collezione</label>
            <Select value={collection} onValueChange={(v) => setParam("collection", v)}>
              <SelectTrigger data-testid="filter-collection-select" className="bg-white border-[#E2DDD5]">
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
            <label className="eyebrow block mb-2">Finitura</label>
            <Select value={finish} onValueChange={(v) => setParam("finish", v)}>
              <SelectTrigger data-testid="filter-finish-select" className="bg-white border-[#E2DDD5]">
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
            <label className="eyebrow block mb-2">Ordina per</label>
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger data-testid="filter-sort-select" className="bg-white border-[#E2DDD5]">
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
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-[#F1EEE8] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24 text-[#78716C]">Nessun prodotto trovato.</div>
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
