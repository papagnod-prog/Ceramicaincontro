import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const SIDE_IMG = "/store/img/login.jpg";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const googleLogin = () => {
  const redirectUrl = window.location.origin + "/store/account";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Login() {
  usePageTitle("Accedi");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(location.state?.error || "");
  const [busy, setBusy] = useState(false);
  const [find, setFind] = useState({ order_number: "", email: "" });
  const [findError, setFindError] = useState("");
  const [findBusy, setFindBusy] = useState(false);

  // Link "Trova il tuo ordine" nel piè di pagina: porta direttamente al modulo.
  useEffect(() => {
    if (location.hash !== "#trova-ordine") return;
    const t = setTimeout(() => document.getElementById("trova-ordine")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [location.hash, location.key]);

  const findOrder = async (e) => {
    e.preventDefault();
    setFindBusy(true);
    setFindError("");
    try {
      const { data } = await api.post("/orders/lookup", find);
      navigate(`/ordine/${encodeURIComponent(data.order_number)}`);
    } catch (err) {
      setFindError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setFindBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/account");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="login-page" className="grid lg:grid-cols-2 min-h-[calc(100vh-5rem)]">
      <div className="hidden lg:block relative">
        <img src={SIDE_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#1C1917]/40" />
        <div className="absolute bottom-10 left-10 text-white">
          <p className="eyebrow text-[#E7C9BE]">since 1976</p>
          <p className="font-serif-display text-3xl mt-2 max-w-xs">L'eleganza della ceramica italiana.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-4xl font-light mb-2">Accedi</h1>
          <p className="text-sm text-[#78716C] mb-8">Bentornato in Ceramica Incontro.</p>

          {error && (
            <div data-testid="login-error" className="bg-[#FBEAE5] text-[#A64B32] text-sm px-4 py-3 mb-4">{error}</div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="eyebrow block mb-2">Email</label>
              <input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
            </div>
            <div>
              <label className="eyebrow block mb-2">Password</label>
              <input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
            </div>
            <button data-testid="login-submit" disabled={busy}
              className="w-full bg-[#1C1917] text-white py-3.5 text-sm font-semibold hover:bg-[#C05A3E] transition-colors disabled:opacity-60">
              {busy ? "Accesso…" : "Accedi"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E2DDD5]" />
            <span className="text-xs text-[#78716C]">oppure</span>
            <div className="flex-1 h-px bg-[#E2DDD5]" />
          </div>

          <button data-testid="google-login-btn" onClick={googleLogin}
            className="w-full border border-[#E2DDD5] bg-white py-3.5 text-sm font-medium hover:bg-[#F1EEE8] transition-colors flex items-center justify-center gap-2">
            <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" />
            Continua con Google
          </button>

          <p className="text-sm text-center text-[#78716C] mt-8">
            Non hai un account?{" "}
            <Link to="/register" className="text-[#C05A3E] font-medium ci-link-underline">Registrati</Link>
          </p>

          <section id="trova-ordine" data-testid="find-order" className="mt-10 pt-8 border-t border-[#E2DDD5] scroll-mt-28">
            <h2 className="font-serif-display text-2xl font-light mb-1">Trova il tuo ordine</h2>
            <p className="text-sm text-[#78716C] mb-5">Anche senza account: inserisci il numero d&rsquo;ordine e l&rsquo;email usata per l&rsquo;acquisto.</p>
            {findError && (
              <div data-testid="find-order-error" className="bg-[#FBEAE5] text-[#A64B32] text-sm px-4 py-3 mb-4">{findError}</div>
            )}
            <form onSubmit={findOrder} className="space-y-4">
              <div>
                <label htmlFor="find-order-number" className="eyebrow block mb-2">Numero ordine</label>
                <input id="find-order-number" data-testid="find-order-number" required placeholder="CI-…" value={find.order_number}
                  onChange={(e) => setFind((f) => ({ ...f, order_number: e.target.value }))}
                  className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
              </div>
              <div>
                <label htmlFor="find-order-email" className="eyebrow block mb-2">Email usata nell&rsquo;ordine</label>
                <input id="find-order-email" data-testid="find-order-email" type="email" required value={find.email}
                  onChange={(e) => setFind((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
              </div>
              <button data-testid="find-order-submit" disabled={findBusy}
                className="w-full border border-[#1C1917] text-[#1C1917] py-3.5 text-sm font-semibold hover:bg-[#1C1917] hover:text-white transition-colors disabled:opacity-60">
                {findBusy ? "Ricerca…" : "Vedi ordine"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
