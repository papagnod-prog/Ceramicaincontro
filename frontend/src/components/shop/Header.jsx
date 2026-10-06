import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ShoppingBag, User, Menu, X, Search, Beaker } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STORE_COLLECTIONS } from "@/lib/collections";
import { useCart } from "@/context/CartContext";
import { useSamples } from "@/context/SamplesContext";
import { useAuth } from "@/context/AuthContext";

const COLLECTIONS = STORE_COLLECTIONS;

export const Header = () => {
  const { count, setOpen } = useCart();
  const { count: sampleCount } = useSamples();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const mobileSearchRef = useRef(null);
  const urlSearch = pathname === "/prodotti" ? params.get("search") || "" : "";

  // Allinea il campo alla ricerca attiva nel catalogo (es. dopo "Cancella").
  useEffect(() => { setQ(urlSearch); }, [urlSearch]);
  useEffect(() => { if (searchOpen) mobileSearchRef.current?.focus(); }, [searchOpen]);

  const submitSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/prodotti?search=${encodeURIComponent(term)}` : "/prodotti");
    setMobileOpen(false);
    setSearchOpen(false);
    e.currentTarget.querySelector("input")?.blur();
  };

  return (
    <header
      data-testid="header-nav-bar"
      className="sticky top-0 z-50 backdrop-blur-md bg-[#F8F6F2]/85 border-b border-[#E2DDD5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" data-testid="brand-logo" className="flex flex-col leading-none">
            <img
              src={`${process.env.PUBLIC_URL}/images/logo-full.png`}
              alt="Ceramica Incontro"
              className="h-9 sm:h-11 w-auto object-contain"
            />
            <span className="eyebrow text-[0.6rem] mt-1 text-[#C05A3E]">fittile_ · dal 1976</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {COLLECTIONS.map((c) => (
              <Link
                key={c}
                to={`/prodotti?collection=${encodeURIComponent(c)}`}
                data-testid="nav-category-link"
                className="text-sm font-medium text-[#57534E] hover:text-[#1C1917] ci-link-underline transition-colors"
              >
                {c}
              </Link>
            ))}
            <Link
              to="/preventivo-progetto"
              data-testid="nav-quote-link"
              className="text-sm font-medium text-[#C05A3E] hover:text-[#A64B32] ci-link-underline transition-colors"
            >
              Preventivi Progetto
            </Link>
            <a
              href="https://ceramicaincontro.it"
              data-testid="nav-corporate-link"
              className="text-sm font-medium text-[#57534E] hover:text-[#1C1917] ci-link-underline transition-colors"
            >
              Sito aziendale
            </a>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3">
            <button
              type="button"
              data-testid="mobile-search-toggle"
              onClick={() => { setSearchOpen((v) => !v); setMobileOpen(false); }}
              className="md:hidden p-2.5 rounded-full hover:bg-[#F1EEE8] transition-colors"
              aria-label={searchOpen ? "Chiudi ricerca" : "Cerca prodotti"}
              aria-expanded={searchOpen}
              aria-controls="mobile-search-panel"
            >
              {searchOpen ? <X className="w-5 h-5 text-[#1C1917]" /> : <Search className="w-5 h-5 text-[#1C1917]" />}
            </button>
            <button
              data-testid="samples-trigger"
              onClick={() => navigate("/campioni")}
              className="relative p-2.5 rounded-full hover:bg-[#F1EEE8] transition-colors"
              aria-label="Campioni"
            >
              <Beaker className="w-5 h-5 text-[#1C1917]" />
              {sampleCount > 0 && (
                <span
                  data-testid="samples-count-badge"
                  className="absolute -top-0.5 -right-0.5 bg-[#C05A3E] text-white text-[0.65rem] font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {sampleCount}
                </span>
              )}
            </button>
            <form onSubmit={submitSearch} className="hidden md:flex items-center relative">
              <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
              <input
                data-testid="search-input"
                type="search"
                enterKeyHint="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Cerca per nome o codice prodotto" placeholder="Nome o codice..."
                className="pl-9 pr-3 py-2 w-40 bg-white border border-[#E2DDD5] rounded-full text-sm focus:outline-none focus:w-52 transition-all"
              />
            </form>
            <button
              data-testid="user-account-trigger"
              onClick={() => navigate(user ? "/account" : "/login")}
              className="p-2.5 rounded-full hover:bg-[#F1EEE8] transition-colors"
              aria-label="Account"
            >
              <User className="w-5 h-5 text-[#1C1917]" />
            </button>
            <button
              data-testid="cart-drawer-trigger"
              onClick={() => setOpen(true)}
              className="relative p-2.5 rounded-full hover:bg-[#F1EEE8] transition-colors"
              aria-label="Carrello"
            >
              <ShoppingBag className="w-5 h-5 text-[#1C1917]" />
              {count > 0 && (
                <span
                  data-testid="cart-count-badge"
                  className="absolute -top-0.5 -right-0.5 bg-[#C05A3E] text-white text-[0.65rem] font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {count}
                </span>
              )}
            </button>
            <button
              className="lg:hidden p-2.5"
              onClick={() => { setMobileOpen((v) => !v); setSearchOpen(false); }}
              aria-label="Menu"
              aria-expanded={mobileOpen}
              data-testid="mobile-menu-toggle"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div id="mobile-search-panel" data-testid="mobile-search-panel" className="md:hidden border-t border-[#E2DDD5] bg-[#F8F6F2] px-4 py-3">
          <form onSubmit={submitSearch} className="flex items-center relative">
            <label htmlFor="mobile-search-input" className="sr-only">Cerca per nome o codice prodotto</label>
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
            <input
              id="mobile-search-input"
              aria-label="Cerca per nome o codice prodotto"
              ref={mobileSearchRef}
              data-testid="mobile-search-input"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome o codice, es. 33P522"
              className="pl-9 pr-24 py-2.5 w-full bg-white border border-[#E2DDD5] rounded-full text-base focus:outline-none focus:border-[#C05A3E]"
            />
            <button
              type="submit"
              data-testid="mobile-search-submit"
              className="absolute right-1 bg-[#C05A3E] hover:bg-[#A64B32] text-white text-sm font-semibold rounded-full px-4 py-1.5 transition-colors"
            >
              Cerca
            </button>
          </form>
        </div>
      )}

      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E2DDD5] bg-[#F8F6F2] px-4 py-5 space-y-3">
          <form onSubmit={submitSearch} className="flex items-center relative mb-3">
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3 text-[#78716C]" />
            <input
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cerca per nome o codice prodotto" placeholder="Nome o codice..."
              className="pl-9 pr-3 py-2.5 w-full bg-white border border-[#E2DDD5] rounded-full text-sm focus:outline-none"
            />
          </form>
          {COLLECTIONS.map((c) => (
            <Link
              key={c}
              to={`/prodotti?collection=${encodeURIComponent(c)}`}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-[#1C1917] font-medium"
            >
              {c}
            </Link>
          ))}
          <Link to="/campioni" onClick={() => setMobileOpen(false)} className="block py-2 text-[#1C1917] font-medium">
            Campioni
          </Link>
          <Link to="/preventivo-progetto" onClick={() => setMobileOpen(false)} className="block py-2 text-[#C05A3E] font-medium">
            Preventivi Progetto
          </Link>
        </div>
      )}
    </header>
  );
};
