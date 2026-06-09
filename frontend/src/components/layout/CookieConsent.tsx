import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';

export const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('zidario_cookies_accepted');
    if (!consent) {
      // Afișează banner-ul cu o ușoară întârziere pentru un efect vizual plăcut
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('zidario_cookies_accepted', 'all');
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    localStorage.setItem('zidario_cookies_accepted', 'necessary');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-[400px] bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-100/60 p-5 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start gap-4">
        <div className="bg-buildorange/10 p-2 rounded-xl text-buildorange shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="font-bold text-slate-900 text-sm">Protecția datelor și Cookies</h4>
            <button
              onClick={handleAcceptNecessary}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Închide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Zidario utilizează fișiere cookie pentru a îmbunătăți experiența de navigare, a analiza traficul și a asigura securitatea. Poți citi mai multe în{' '}
            <Link to="/privacy" className="text-buildorange hover:underline font-medium">
              Politica de Confidențialitate
            </Link>
            .
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={handleAcceptNecessary}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            >
              Doar necesare
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-buildorange hover:bg-buildorange/95 rounded-lg shadow-sm hover:shadow transition-all"
            >
              Acceptă toate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
