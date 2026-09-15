import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";

const SIDE_IMG = "https://images.unsplash.com/photo-1710762797203-707c26233cee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const googleLogin = () => {
  const redirectUrl = window.location.origin + "/account";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          <p className="eyebrow text-[#E7C9BE]">fittile_ dal 1976</p>
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
        </div>
      </div>
    </div>
  );
}
