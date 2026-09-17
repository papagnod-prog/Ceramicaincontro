import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const SIDE_IMG = "https://images.unsplash.com/photo-1673731535556-665e8b8041fe?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";

export default function Register() {
  usePageTitle("Registrati");
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(name, email, password);
      navigate("/account");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="register-page" className="grid lg:grid-cols-2 min-h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-center p-8 order-2 lg:order-1">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-4xl font-light mb-2">Crea un account</h1>
          <p className="text-sm text-[#78716C] mb-8">Ordini più veloci e storico acquisti.</p>

          {error && (
            <div data-testid="register-error" className="bg-[#FBEAE5] text-[#A64B32] text-sm px-4 py-3 mb-4">{error}</div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="eyebrow block mb-2">Nome</label>
              <input data-testid="register-name" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
            </div>
            <div>
              <label className="eyebrow block mb-2">Email</label>
              <input data-testid="register-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
            </div>
            <div>
              <label className="eyebrow block mb-2">Password</label>
              <input data-testid="register-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#E2DDD5] px-4 py-3 focus:outline-none focus:border-[#C05A3E]" />
            </div>
            <button data-testid="register-submit" disabled={busy}
              className="w-full bg-[#1C1917] text-white py-3.5 text-sm font-semibold hover:bg-[#C05A3E] transition-colors disabled:opacity-60">
              {busy ? "Creazione…" : "Registrati"}
            </button>
          </form>

          <p className="text-sm text-center text-[#78716C] mt-8">
            Hai già un account?{" "}
            <Link to="/login" className="text-[#C05A3E] font-medium ci-link-underline">Accedi</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block relative order-1 lg:order-2">
        <img src={SIDE_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#1C1917]/40" />
      </div>
    </div>
  );
}
