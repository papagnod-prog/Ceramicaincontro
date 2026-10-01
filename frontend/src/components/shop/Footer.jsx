import { Link } from "react-router-dom";
import { COMPANY } from "@/lib/company";

export const Footer = () => (
  <footer className="bg-[#1C1917] text-[#F8F6F2] mt-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="font-serif-display text-3xl mb-3">Ceramica Incontro</div>
          <p className="text-[#A8A29E] text-sm max-w-sm leading-relaxed">
            Dal 1976 specializzati nell'esclusiva produzione di battiscopa e rivestimenti
            in ceramica. L'innovazione del battiscopa, made in Corato.
          </p>
          <p className="eyebrow text-[#C05A3E] mt-4">fittile_</p>
        </div>
        <div>
          <h4 className="eyebrow mb-4 text-[#78716C]">Collezioni</h4>
          <ul className="space-y-2 text-sm text-[#D6D3D1]">
            {["SMUSSO", "Battiscopa", "Moon Spots", "Paper Glass", "Stony"].map((c) => (
              <li key={c}>
                <Link to={`/prodotti?collection=${encodeURIComponent(c)}`} className="hover:text-white transition-colors">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="eyebrow mb-4 text-[#78716C]">Servizi</h4>
          <ul className="space-y-2 text-sm text-[#D6D3D1]">
            <li>
              <Link to="/campioni" className="hover:text-white transition-colors">Campioni</Link>
            </li>
            <li>
              <Link to="/preventivo-progetto" className="hover:text-white transition-colors">Preventivi Progetto</Link>
            </li>
            <li>
              <Link to="/prodotti" className="hover:text-white transition-colors">Negozio</Link>
            </li>
            <li>
              <Link to="/account" className="hover:text-white transition-colors">Il mio account</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow mb-4 text-[#78716C]">Contatti</h4>
          <ul className="space-y-2 text-sm text-[#D6D3D1]">
            <li>S.P. 231, Km 34,200</li>
            <li>70033 Corato (BA), Italia</li>
            <li><a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="hover:text-white">Tel. {COMPANY.phone}</a></li>
            <li><a href={`mailto:${COMPANY.email}`} className="hover:text-white">{COMPANY.email}</a></li>
            <li>PEC: {COMPANY.pec}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#3A3733] mt-12 pt-6 text-xs text-[#A8A29E] space-y-3">
        <p>
          © {new Date().getFullYear()} {COMPANY.name} — Sede legale: {COMPANY.address} — P.IVA {COMPANY.vat} — REA {COMPANY.rea} — Capitale sociale € {COMPANY.capital}
        </p>
        <p>Prezzi IVA esclusa ove indicato · Pagamento tramite bonifico bancario</p>
        <nav aria-label="Informazioni legali" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacy" className="hover:text-white underline">Privacy</Link>
          <Link to="/cookie" className="hover:text-white underline">Cookie</Link>
          <Link to="/condizioni-di-vendita" className="hover:text-white underline">Condizioni di vendita</Link>
          <Link to="/recesso" className="hover:text-white underline">Diritto di recesso</Link>
          <Link to="/note-legali" className="hover:text-white underline">Note legali</Link>
          <Link to="/accessibilita" className="hover:text-white underline">Accessibilità</Link>
        </nav>
      </div>
    </div>
  </footer>
);
