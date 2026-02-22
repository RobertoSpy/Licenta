import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      // Răspunsul trebuie să conțină accessToken-ul, cookie-ul de refresh e trimis automat de backend.
      login(response.data.accessToken, response.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Conexiunea a eșuat. Verifică datele introduse.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Partea stângă - Vizual (Ascuns pe mobil) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-buildnavy">
        <div className="absolute inset-0 bg-gradient-to-br from-buildnavy/80 to-slate-900/90 z-10" />
        <img
          src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2000&auto=format&fit=crop"
          alt="Architecture construction"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
        />
        <div className="relative z-20 flex flex-col justify-center h-full p-20 text-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Building2 className="w-16 h-16 text-buildorange mb-8" />
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
              Construiește viitorul cu <span className="text-buildorange">BuildWise AI</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              Platforma inteligentă pentru generarea planurilor 3D și preluarea devizelor în timp real din marile magazine de bricolaj.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Partea dreaptă - Formularul de Login */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-white relative">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="mb-10 lg:hidden">
            <Building2 className="w-12 h-12 text-buildorange mb-4" />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Bine ai revenit</h2>
          <p className="text-slate-500 mt-2 mb-8">Introdu credențiale tale pentru a accesa panoul tău de proiecte.</p>

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

            <Input
              label="Parolă"
              type="password"
              icon={<Lock className="w-5 h-5" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-slate-300 text-buildorange focus:ring-buildorange" />
                <span className="ml-2 text-sm text-slate-600">Ține-mă minte</span>
              </label>
              <a href="#" className="text-sm font-medium text-buildorange hover:text-orange-600">
                Ai uitat parola?
              </a>
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Conectare
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Nu ai un cont?{' '}
            <Link to="/register" className="font-medium text-buildorange hover:text-orange-700 transition-colors">
              Creează unul acum
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
