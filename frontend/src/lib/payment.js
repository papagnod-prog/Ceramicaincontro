// Etichette leggibili dello stato del pagamento (pannello amministratore).
export const paymentLabel = (o) => {
  const card = (o?.payment_method || "card") === "card";
  const map = card
    ? { paid: "Pagato (carta)", pending: "Carta – in attesa di pagamento", expired: "Carta – non pagato (sessione scaduta)", refunded: "Rimborsato (carta)" }
    : { paid: "Pagato (bonifico)", awaiting_transfer: "In attesa di bonifico", refunded: "Rimborsato" };
  return map[o?.payment_status] || (o?.payment_status === "cod_pending" ? "Contanti alla consegna" : o?.payment_status || "");
};

export const paymentOk = (o) => ["paid", "cod_pending", "awaiting_transfer"].includes(o?.payment_status);
