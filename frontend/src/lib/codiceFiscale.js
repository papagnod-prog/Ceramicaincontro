// Controllo del codice fiscale delle persone fisiche (16 caratteri).
// Accetta i codici "omocodici", in cui alcune cifre sono sostituite da
// lettere (L M N P Q R S T U V), e verifica il carattere di controllo finale.

const CF_PATTERN = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

// Valori dei caratteri in posizione dispari (1ª, 3ª, … contando da 1).
const ODD = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const evenValue = (ch) => (/[0-9]/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65);

/** Maiuscolo e senza spazi: è la forma che salviamo nell'ordine. */
export function normalizeCodiceFiscale(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

/** true se il codice (già normalizzato o no) è un codice fiscale valido. */
export function isValidCodiceFiscale(value) {
  const cf = normalizeCodiceFiscale(value);
  if (!CF_PATTERN.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    const ch = cf[i];
    sum += i % 2 === 0 ? ODD[ch] : evenValue(ch);
  }
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}
