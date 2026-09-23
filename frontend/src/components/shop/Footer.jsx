import { Link } from "react-router-dom";

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
              <Link to="/campioni" className="hover:text-white transition-colors">Campioni gratuiti</Link>
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
            <li>Sp 231 km 34,200</li>
            <li>70033 Corato (BA), Italia</li>
            <li>Tel. 080 898 4326</li>
            <li>info@ceramicaincontro.it</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#3A3733] mt-12 pt-6 text-xs text-[#78716C] flex flex-col sm:flex-row justify-between gap-2">
        <span>© {new Date().getFullYear()} Ceramica Incontro S.r.l. — P.IVA 00669920720</span>
        <span>Prezzi iva esclusa · Pagamenti sicuri con Stripe</span>
      </div>
    </div>
  </footer>
);
