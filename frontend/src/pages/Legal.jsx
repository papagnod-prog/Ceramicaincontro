import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { COMPANY, TERMS_VERSION } from "@/lib/company";

// Segnaposto visibile per dati ancora da confermare con il titolare/consulente.
const Todo = ({ children }) => (
  <mark className="bg-yellow-200 text-[#1C1917] px-1" data-testid="legal-todo">[DA CONFERMARE: {children}]</mark>
);

const Shell = ({ title, children }) => {
  usePageTitle(title);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12" data-testid="legal-page">
      <h1 className="font-serif-display text-4xl font-light mb-2">{title}</h1>
      <p className="text-xs text-[#78716C] mb-8">Versione {TERMS_VERSION} — Testo in revisione: non ancora definitivo.</p>
      <div className="space-y-4 text-sm leading-relaxed text-[#292524] [&_h2]:font-serif-display [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-[#A64B32] [&_a]:underline">
        {children}
      </div>
    </div>
  );
};

const Owner = () => (
  <p>
    <strong>{COMPANY.name}</strong> — sede legale: {COMPANY.address} — P.IVA {COMPANY.vat} — REA {COMPANY.rea} — capitale
    sociale € {COMPANY.capital} <Todo>versato i.v.? codice fiscale</Todo> — PEC {COMPANY.pec} — email{" "}
    <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> — tel. {COMPANY.phone}.
  </p>
);

export const Privacy = () => (
  <Shell title="Informativa sulla privacy">
    <p>Informativa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) per gli utenti del negozio online Ceramica Incontro (sezione /store).</p>
    <h2>1. Titolare del trattamento</h2>
    <Owner />
    <p>Per esercitare i tuoi diritti o per qualsiasi richiesta sulla privacy: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
    <h2>2. Dati trattati, finalità e basi giuridiche</h2>
    <ul>
      <li><strong>Ordini e acquisti</strong> (nome, email, telefono, indirizzi di spedizione e fatturazione, dati fiscali per le aziende, contenuto dell'ordine): esecuzione del contratto e adempimenti precontrattuali (art. 6.1.b GDPR).</li>
      <li><strong>Obblighi fiscali e contabili</strong> (fatturazione, conservazione delle scritture): obbligo di legge (art. 6.1.c). Conservazione per 10 anni.</li>
      <li><strong>Registrazione account</strong> (nome, email, password cifrata): esecuzione del servizio richiesto (art. 6.1.b). Dati conservati fino alla cancellazione dell'account.</li>
      <li><strong>Richieste di campioni e preventivi</strong>: misure precontrattuali su tua richiesta (art. 6.1.b). Conservazione fino a 24 mesi dall'ultima comunicazione <Todo>conferma periodo</Todo>.</li>
      <li><strong>Comunicazioni di servizio</strong> (email di conferma e aggiornamento stato dell'ordine): esecuzione del contratto.</li>
      <li><strong>Difesa di diritti in sede giudiziaria</strong>: legittimo interesse (art. 6.1.f).</li>
    </ul>
    <p>Non utilizziamo i dati per marketing diretto né per profilazione. Se in futuro lo faremo, chiederemo un consenso separato e facoltativo.</p>
    <h2>3. Prova di accettazione</h2>
    <p>Quando accetti le condizioni o confermi di aver letto questa informativa, registriamo data e ora, versione dei testi e una versione abbreviata dell'indirizzo IP, a prova dell'accettazione.</p>
    <h2>4. Destinatari</h2>
    <p>I dati sono trattati da personale autorizzato e da fornitori nominati responsabili del trattamento: hosting e infrastruttura del sito <Todo>fornitore hosting</Todo>, database <Todo>fornitore database/regione</Todo>, invio email transazionali <Todo>fornitore SMTP</Todo>, corrieri per la consegna <Todo>corriere</Todo>, istituto di credito per il bonifico, consulenti fiscali e amministrativi.</p>
    <h2>5. Trasferimenti extra UE</h2>
    <p>Dove un fornitore tratti dati fuori dallo Spazio Economico Europeo, il trasferimento avviene con le garanzie previste dagli artt. 44-49 GDPR (decisione di adeguatezza o clausole contrattuali standard) <Todo>verifica per ciascun fornitore</Todo>.</p>
    <h2>6. Cookie e strumenti di tracciamento</h2>
    <p>Questo negozio usa solo memorizzazione tecnica nel browser (carrello, richiesta campioni, sessione di accesso), non soggetta a consenso. Non utilizza strumenti di analisi né pubblicità. Dettagli nella <Link to="/cookie">Cookie policy</Link>.</p>
    <h2>7. I tuoi diritti</h2>
    <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti al trattamento (artt. 15-22 GDPR) scrivendo a {COMPANY.email}. Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
    <h2>8. Conferimento dei dati</h2>
    <p>I dati richiesti nei moduli sono necessari per completare l'ordine o rispondere alla tua richiesta; senza di essi non possiamo darvi seguito.</p>
    <h2>9. Assistente virtuale</h2>
    <p>Sul sito WordPress è presente un assistente basato su regole automatiche, che dichiara di non essere una persona. L'informativa dedicata è pubblicata sul sito principale.</p>
  </Shell>
);

export const Cookie = () => (
  <Shell title="Cookie policy">
    <p>Questa pagina descrive l'uso di cookie e tecnologie simili nel negozio online (/store). Il sito vetrina ceramicaincontro.it ha una propria cookie policy e un proprio banner.</p>
    <h2>Strumenti usati dal negozio</h2>
    <p>Il negozio usa soltanto memorizzazione <strong>tecnica e necessaria</strong> nel browser (localStorage / cookie di sessione). Non richiede consenso (art. 122 Codice Privacy; Linee guida del Garante 2021).</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left border border-[#E2DDD5] text-xs">
        <caption className="sr-only">Elenco della memorizzazione tecnica usata dal negozio</caption>
        <thead className="bg-[#F1EEE8]"><tr><th scope="col" className="p-2">Nome</th><th scope="col" className="p-2">Finalità</th><th scope="col" className="p-2">Durata</th></tr></thead>
        <tbody>
          <tr className="border-t"><td className="p-2">Carrello</td><td className="p-2">Conservare gli articoli scelti</td><td className="p-2">Fino a svuotamento</td></tr>
          <tr className="border-t"><td className="p-2">Richiesta campioni</td><td className="p-2">Conservare i campioni selezionati</td><td className="p-2">Fino a invio</td></tr>
          <tr className="border-t"><td className="p-2">Sessione di accesso</td><td className="p-2">Mantenere il login all'account</td><td className="p-2">7 giorni</td></tr>
        </tbody>
      </table>
    </div>
    <h2>Analisi e pubblicità</h2>
    <p>Nel negozio non sono presenti cookie analitici, di profilazione o di terze parti. Se verranno introdotti, mostreremo un banner e attiveremo gli strumenti solo dopo il tuo consenso.</p>
    <h2>Pagamenti</h2>
    <p>Il pagamento avviene tramite bonifico bancario: nessun dato di carta transita dal negozio.</p>
    <h2>Come cancellare i dati</h2>
    <p>Puoi eliminare la memorizzazione dalle impostazioni del tuo browser. Informativa completa: <Link to="/privacy">Privacy</Link>.</p>
  </Shell>
);

export const Terms = () => (
  <Shell title="Condizioni generali di vendita">
    <h2>1. Venditore</h2>
    <Owner />
    <h2>2. Ambito</h2>
    <p>Le presenti condizioni regolano la vendita a distanza dei prodotti ceramici (battiscopa, rivestimenti e accessori) proposti nel negozio online, a consumatori e a clienti professionali (aziende, partita IVA). Le norme a tutela del consumatore (D.Lgs. 206/2005, Codice del Consumo) si applicano solo ai consumatori.</p>
    <h2>3. Prodotti e prezzi</h2>
    <p>I prezzi sono indicati per unità di misura (es. metro lineare) e, dove specificato, <strong>IVA esclusa</strong>; l'IVA e le spese di trasporto sono mostrate nel riepilogo prima della conferma. Le immagini sono indicative: tonalità e finitura della ceramica possono variare da lotto a lotto. Per verificare il colore è possibile richiedere dei campioni.</p>
    <h2>4. Conclusione del contratto e obbligo di pagamento</h2>
    <p>Cliccando su <strong>«Ordine con obbligo di pagamento»</strong> il cliente invia una proposta d'acquisto. Il contratto si conclude con la nostra conferma dell'ordine via email. Al cliente è richiesto il pagamento secondo il metodo scelto.</p>
    <h2>5. Pagamento</h2>
    <p>Il pagamento avviene tramite <strong>bonifico bancario</strong> secondo le coordinate indicate nell'email di conferma, con il numero d'ordine come causale. L'ordine viene preparato alla ricezione del pagamento. <Todo>termine entro cui effettuare il bonifico e altri metodi di pagamento eventualmente attivi</Todo></p>
    <h2>6. Spedizione e consegna</h2>
    <p>La spedizione è effettuata in Italia con corriere <Todo>corriere e tempi di consegna</Todo>. Le spese dipendono da peso, destinazione e opzione scelta e sono indicate prima dell'ordine. L'opzione «Consegna a piano strada» prevede la consegna al piano strada (non al piano). Alla consegna il cliente deve verificare imballo e quantità e segnalare al corriere eventuali danni (riserva scritta sul documento di consegna), informandoci entro 8 giorni.</p>
    <h2>7. Diritto di recesso (consumatori)</h2>
    <p>Il consumatore può recedere entro 14 giorni dal ricevimento dei beni senza indicarne il motivo, secondo le modalità della pagina <Link to="/recesso">Diritto di recesso</Link>.</p>
    <h2>8. Garanzia legale di conformità</h2>
    <p>Ai consumatori si applica la garanzia legale di conformità di 2 anni (artt. 128 ss. Codice del Consumo). Per i professionisti si applicano gli artt. 1490 ss. c.c. con denuncia dei vizi entro 8 giorni dalla scoperta.</p>
    <h2>9. Assistenza e reclami</h2>
    <p>Per assistenza: {COMPANY.email}, tel. {COMPANY.phone}. I consumatori possono utilizzare la piattaforma europea ODR per la risoluzione online delle controversie: <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
    <h2>10. Legge applicabile e foro</h2>
    <p>Legge italiana. Per i consumatori è competente il foro di residenza o domicilio del consumatore; per i professionisti il foro di <Todo>foro competente, es. Trani/Bari</Todo>.</p>
    <h2>11. Privacy</h2>
    <p>I dati personali sono trattati secondo l'<Link to="/privacy">Informativa privacy</Link>.</p>
  </Shell>
);

export const Withdrawal = () => (
  <Shell title="Diritto di recesso">
    <h2>Chi può recedere</h2>
    <p>Il diritto di recesso spetta ai <strong>consumatori</strong> (acquisti per scopi estranei all'attività professionale). Non spetta ai clienti professionali.</p>
    <h2>Termini</h2>
    <p>Hai 14 giorni dal giorno in cui ricevi i beni (o l'ultimo bene, se l'ordine è consegnato in più spedizioni) per recedere senza indicare il motivo.</p>
    <h2>Come esercitarlo</h2>
    <p>Invia una comunicazione esplicita a <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> o alla PEC {COMPANY.pec}, indicando numero d'ordine, nome e prodotti. Puoi usare il modulo seguente (facoltativo).</p>
    <blockquote className="border-l-4 border-[#C05A3E] bg-white p-4 text-xs">
      «Io sottoscritto/a ___ comunico di recedere dal contratto di vendita dei seguenti beni: ___ ordinati il ___ / ricevuti il ___ — numero d'ordine ___ — indirizzo ___ — data e firma (solo se su carta).»
    </blockquote>
    <h2>Restituzione dei beni e rimborso</h2>
    <p>Devi restituire i beni entro 14 giorni dalla comunicazione di recesso, integri, nell'imballo originale. Le spese di restituzione sono a carico di <Todo>cliente o venditore</Todo>. Rimborsiamo tutti i pagamenti, incluse le spese di consegna standard, entro 14 giorni dalla comunicazione del recesso, con lo stesso mezzo di pagamento (o bonifico), potendo sospendere il rimborso fino al ricevimento dei beni.</p>
    <h2>Eccezioni</h2>
    <p>Il recesso non si applica ai beni confezionati su misura o chiaramente personalizzati (art. 59 Codice del Consumo). <Todo>prodotti tagliati su misura o fuori catalogo da escludere</Todo> Il consumatore risponde della diminuzione di valore dei beni dovuta a manipolazione non necessaria.</p>
    <h2>Merce danneggiata o non conforme</h2>
    <p>In questi casi si applica la garanzia legale: scrivi a {COMPANY.email} allegando foto.</p>
  </Shell>
);

export const LegalNotes = () => (
  <Shell title="Note legali">
    <h2>Dati societari</h2>
    <Owner />
    <h2>Proprietà intellettuale</h2>
    <p>Marchi, immagini, testi, disegni e grafica del sito sono di proprietà di {COMPANY.name} o dei rispettivi titolari e non possono essere riprodotti senza autorizzazione.</p>
    <h2>Limitazione di responsabilità</h2>
    <p>Pur curando l'accuratezza delle informazioni, non garantiamo l'assenza di errori: colori, formati e disponibilità sono indicativi e possono variare.</p>
    <h2>Link</h2>
    <p>Per le informazioni sul trattamento dei dati vedi l'<Link to="/privacy">Informativa privacy</Link>; per i cookie la <Link to="/cookie">Cookie policy</Link>.</p>
  </Shell>
);

export const Accessibility = () => (
  <Shell title="Dichiarazione di accessibilità">
    <p>{COMPANY.name} si impegna a rendere il negozio online accessibile ai sensi della Direttiva (UE) 2019/882 (European Accessibility Act) e del D.Lgs. 82/2022 / norma EN 301 549, livello WCAG 2.1 AA.</p>
    <h2>Stato di conformità</h2>
    <p>Il sito è <strong>parzialmente conforme</strong> alle WCAG 2.1 livello AA. Stiamo completando verifiche manuali con tecnologie assistive. Data della dichiarazione: {TERMS_VERSION}.</p>
    <h2>Misure adottate</h2>
    <ul>
      <li>Link «Vai al contenuto principale» e struttura con regioni principali.</li>
      <li>Etichette associate ai campi dei moduli e indicatore di focus visibile.</li>
      <li>Alternative testuali per le immagini di prodotto.</li>
    </ul>
    <h2>Contenuti non ancora accessibili</h2>
    <ul>
      <li>Alcune immagini decorative o di galleria possono non avere descrizioni complete.</li>
      <li>Verifica dei contrasti e della navigazione da tastiera nell'area amministrativa non ancora conclusa.</li>
    </ul>
    <h2>Feedback e contatti</h2>
    <p>Per segnalare problemi di accessibilità o richiedere contenuti in formato alternativo: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, tel. {COMPANY.phone}. Rispondiamo entro <Todo>tempo di risposta, es. 15 giorni</Todo>.</p>
    <h2>Procedura di attuazione</h2>
    <p>In caso di risposta insoddisfacente puoi rivolgerti all'Agenzia per l'Italia Digitale (AgID): <a href="https://www.agid.gov.it" rel="noopener noreferrer">www.agid.gov.it</a>.</p>
  </Shell>
);
