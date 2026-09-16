import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Landmark, Banknote } from "lucide-react";

export default function PaymentConfirmation() {
  const [params] = useSearchParams();
  const orderNumber = params.get("order");
  const method = params.get("method");

  const isBankTransfer = method === "bank_transfer";
  const isCash = method === "cash";

  return (
    <div data-testid="payment-confirmation-page" className="max-w-lg mx-auto px-4 py-24 text-center">
      <CheckCircle2 className="w-16 h-16 text-[#6B7A6E] mx-auto mb-6" strokeWidth={1.5} />
      <h1 className="font-serif-display text-4xl font-light">Grazie per il tuo ordine!</h1>
      {orderNumber && (
        <p className="text-[#57534E] mt-3">
          Numero ordine: <span className="font-semibold">{orderNumber}</span>
        </p>
      )}

      {isBankTransfer && (
        <div className="bg-[#F8F6F2] border border-[#E2DDD5] px-6 py-5 mt-8 text-left">
          <div className="flex items-center gap-2 text-[#C05A3E] mb-2">
            <Landmark className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm font-medium">Bonifico bancario</span>
          </div>
          <p className="text-sm text-[#78716C]">
            Ti abbiamo inviato un'email con l'IBAN e i dettagli per completare il bonifico.
            L'ordine verrà preparato non appena riceveremo il pagamento.
          </p>
        </div>
      )}

      {isCash && (
        <div className="bg-[#F8F6F2] border border-[#E2DDD5] px-6 py-5 mt-8 text-left">
          <div className="flex items-center gap-2 text-[#C05A3E] mb-2">
            <Banknote className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm font-medium">Contanti alla consegna / ritiro</span>
          </div>
          <p className="text-sm text-[#78716C]">
            Nessun pagamento anticipato richiesto. Pagherai in contanti al momento della consegna
            o del ritiro. Riceverai una email di conferma con i dettagli dell'ordine.
          </p>
        </div>
      )}

      <p className="text-[#78716C] mt-6">
        Riceverai una conferma via email con i dettagli della spedizione.
      </p>
      <div className="flex gap-4 justify-center mt-8">
        <Link to="/account" className="bg-[#1C1917] text-white px-6 py-3 text-sm font-medium hover:bg-[#C05A3E] transition-colors">
          I miei ordini
        </Link>
        <Link to="/prodotti" className="border border-[#E2DDD5] px-6 py-3 text-sm font-medium hover:bg-white transition-colors">
          Continua lo shopping
        </Link>
      </div>
    </div>
  );
}
