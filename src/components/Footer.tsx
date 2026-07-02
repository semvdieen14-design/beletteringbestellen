import { Mail, Phone, MessageCircle, Facebook } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CookieBanner } from './CookieBanner';

export function Footer() {
  return (
    <footer className="bg-foreground text-background pt-20 pb-12">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-16">
          {/* Logo & About */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center">
              <img
                src="/assets/logo-beletteringbestellen.png"
                alt="Belettering Bestellen"
                className="h-24 w-auto"
              />
            </div>
            <p className="text-background/60 max-w-sm leading-relaxed text-lg font-medium">
              Wij maken design toegankelijk voor iedereen. Hoogwaardige belettering, voor een fractie van de prijs.
            </p>
          </div>
          
          {/* Klantenservice */}
          <div className="space-y-6">
            <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-background/50">Klantenservice</h4>
            <ul className="space-y-4 text-background/60 font-medium">
              <li>
                <Link to="/faq" className="hover:text-primary transition">Hulp bij plakken</Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-primary transition">Blog & tips</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition">Contact opnemen</Link>
              </li>
            </ul>
          </div>

          {/* Belettering */}
          <div className="space-y-6">
            <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-background/50">Belettering</h4>
            <ul className="space-y-4 text-background/60 font-medium">
              <li>
                <Link to="/autobelettering" className="hover:text-primary transition">Autobelettering</Link>
              </li>
              <li>
                <Link to="/raambelettering" className="hover:text-primary transition">Raambelettering</Link>
              </li>
              <li>
                <Link to="/bootbelettering" className="hover:text-primary transition">Bootbelettering</Link>
              </li>
              <li>
                <Link to="/muur-belettering" className="hover:text-primary transition">Muurbelettering</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-background/50">Contact</h4>
            <div className="space-y-3 text-background/60 font-medium">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:info@beletteringbestellen.nl" className="hover:text-primary transition">
                  info@beletteringbestellen.nl
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="tel:+31614145350" className="hover:text-primary transition">
                  06 14 14 53 50
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <a href="https://wa.me/31614145350" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">
                  WhatsApp
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4" />
                <a href="https://www.facebook.com/share/1aZKpr45on/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">
                  Facebook
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-background/10 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-background/40 font-medium space-y-1 text-center md:text-left">
            <p>© {new Date().getFullYear()} BeletteringBestellen.nl — RHTTOURS B.V.</p>
            <p>KvK: 95053115 · BTW: NL866981755B01</p>
          </div>
          <div className="flex gap-4 text-sm text-background/40">
            <Link to="/algemene-voorwaarden" className="hover:text-background/70 transition">Algemene voorwaarden</Link>
            <Link to="/privacybeleid" className="hover:text-background/70 transition">Privacybeleid</Link>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-background/40 font-medium">
          Gemaakt door{' '}
          <a
            href="https://www.instagram.com/svd_web?utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition"
          >
            SVD Web
          </a>
        </div>
        <CookieBanner />
      </div>
    </footer>
  );
}
