import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { setToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : null;

    if (!sessionId) {
      navigate("/login");
      return;
    }

    api
      .post("/auth/session", { session_id: sessionId })
      .then(({ data }) => {
        setToken(data.token);
        setUser(data.user);
        window.history.replaceState(null, "", "/account");
        navigate("/account", { state: { user: data.user } });
      })
      .catch(() => navigate("/login"));
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-[#78716C]">
      Accesso in corso…
    </div>
  );
}
