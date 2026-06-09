import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Mail, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      // Redirecționăm cu emailul în state — ResetPassword îl va folosi
      navigate('/reset-password', { state: { email } });
    } catch {
      // Backend returnează mereu 200, erorile apar doar la probleme de rețea
      setError('Eroare de rețea. Verifică conexiunea și încearcă din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Panoul stâng — vizual */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-buildnavy">
        <div className="absolute inset-0 bg-gradient-to-br from-buildnavy/80 to-slate-900/90 z-10" />
        <img
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop"
          alt="Modern architecture"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
        />
        <div className="relative z-20 flex flex-col justify-center h-full p-20 text-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Building2 className="w-16 h-16 text-buildorange mb-8" />
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
              Recuperează accesul la <span className="text-buildorange">Proiectele Tale</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              Îți vom trimite un cod de verificare pe email. Simplu, rapid și sigur.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Panoul drept — formular */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-white relative">
        <Link to="/" className="absolute top-8 left-8 sm:left-16 lg:left-24 xl:left-32 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-buildorange transition-colors">
          <ArrowLeft className="w-4 h-4" /> Înapoi acasă
        </Link>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="mb-8 lg:hidden">
            <Building2 className="w-12 h-12 text-buildorange mb-4" />
          </div>

          <Link to="/login" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-buildorange mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Înapoi la autentificare
          </Link>

          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Recuperare Parolă</h2>
          <p className="text-slate-500 mt-2 mb-8">
            Introdu adresa de email a contului tău și îți vom trimite un cod de verificare de 6 cifre.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                {error}
              </div>
            )}

            <Input
              label="Adresă Email"
              type="email"
              icon={<Mail className="w-5 h-5" />}
              placeholder="arhitect@companie.ro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Trimite Codul de Verificare
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Ai probleme?{' '}
            <a href="mailto:support@zidario.ro" className="font-medium text-buildorange hover:text-orange-700 transition-colors">
              Contactează suportul
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
