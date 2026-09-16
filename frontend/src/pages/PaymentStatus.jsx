import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("checking"); // checking, paid, error, timeout
  const [orderNumber, setOrderNumber] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let attempts = 0;
    const poll = async () => {
      if (attempts >= 8) {
        setStatus("timeout");
        return;
      }
      attempts += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        setOrderNumber(data.order_number);
        if (data.payment_status === "paid") {
          setStatus("paid");
          return;
        }
        if (data.status === "expired") {
          setStatus("error");
          return;
        }
      } catch {
        setStatus("error");
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
  }, [sessionId]);

  return (
    <div data-testid="payment-success-page" className="max-w-lg mx-auto px-4 py-24 text-center">
      {status === "checking" && (
        <>
          <Loader2 className="w-12 h-12 text-[#C05A3E] animate-spin mx-auto mb-6" />
          <h1 className="font-serif-display text-3xl">Verifica del pagamento…</h1>
          <p className="text-[#78716C] mt-2">Attendere un istante.</p>
        </>
      )}
      {status === "paid" && (
        <>
          <CheckCircle2 className="w-16 h-16 text-[#6B7A6E] mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="font-serif-display text-4xl font-light">Grazie per il tuo ordine!</h1>
          {orderNumber && <p className="text-[#57534E] mt-3">Numero ordine: <span className="font-semibold">{orderNumber}</span></p>}
          <p className="text-[#78716C] mt-2">Riceverai una conferma via email con i dettagli della spedizione.</p>
          <div className="flex gap-4 justify-center mt-8">
            <Link to="/account" className="bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#C05A3E] transition-colors">I miei ordini</Link>
            <Link to="/prodotti" className="border border-[#E2DDD5] px-6 py-3 text-sm font-medium hover:bg-white transition-colors">Continua lo shopping</Link>
          </div>
        </>
      )}
      {(status === "error" || status === "timeout") && (
        <>
          <XCircle className="w-16 h-16 text-[#C05A3E] mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="font-serif-display text-3xl">
            {status === "timeout" ? "Pagamento in elaborazione" : "Qualcosa è andato storto"}
          </h1>
          <p className="text-[#78716C] mt-2">
            {status === "timeout"
              ? "Il pagamento potrebbe richiedere qualche minuto. Controlla i tuoi ordini a breve."
              : "Non è stato possibile confermare il pagamento."}
          </p>
          <Link to="/prodotti" className="inline-block mt-8 bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#C05A3E] transition-colors">Torna al negozio</Link>
        </>
      )}
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div data-testid="payment-cancel-page" className="max-w-lg mx-auto px-4 py-24 text-center">
      <XCircle className="w-16 h-16 text-[#8C8275] mx-auto mb-6" strokeWidth={1.5} />
      <h1 className="font-serif-display text-4xl font-light">Pagamento annullato</h1>
      <p className="text-[#78716C] mt-3">Nessun addebito effettuato. Il tuo carrello è ancora disponibile.</p>
      <Link to="/checkout" className="inline-block mt-8 bg-[#C05A3E] text-white px-6 py-3 text-sm font-medium hover:bg-[#A64B32] transition-colors">Riprova il checkout</Link>
    </div>
  );
}
