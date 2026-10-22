/** Collezioni visibili nel negozio, nell'ordine richiesto. Gli altri dati restano intatti nell'API. */
export const STORE_COLLECTIONS = ["SMUSSO", "Battiscopa"];

/** Nome mostrato nel negozio (filtro, titolo catalogo, menu, etichetta delle schede). */
export const COLLECTION_LABELS = { SMUSSO: "SMUSSO 7x60", Battiscopa: "Battiscopa 8x33" };

export const collectionLabel = (c) => COLLECTION_LABELS[c] || c;
