import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/useAuth';

export const VerifyEmail = () => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      // Dacă utilizatorul a ajuns aici direct prin URL, fără email, îl trimitem la login
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    if (otp.length !== 6) {
      setError('Codul trebuie să aibă 6 cifre.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/verify-email', { email, otp });
      
      // Anunțăm contextul de Auth că avem un utilizator valid acum
      login(res.data.accessToken, res.data.user);
      
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Codul este invalid sau a expirat.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.post('/auth/resend-verification', { email });
      setSuccessMsg('Un nou cod a fost trimis pe email!');
      setCountdown(60); // Resetăm timer-ul
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Eroare la retrimiterea codului.');
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null; // Evităm renderizarea dacă se face redirect

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Partea stângă - Variație a UI-ului arhitectural */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply z-10" />
        <img
          src="https://images.unsplash.com/photo-1541888086925-920a0f4438f7?q=80&w=2000&auto=format&fit=crop"
          alt="Modern Construction"
          className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-1000"
        />
        <div className="relative z-20 flex flex-col justify-end h-full p-20 text-white pb-32">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Securitatea datelor tale este prioritară
            </h2>
            <div className="w-20 h-1 bg-buildorange mb-6"></div>
            <p className="text-lg text-slate-300 max-w-lg">
              Protejăm planurile și estimările tale cu cele mai bune practici din industrie.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Partea dreaptă - Formularul de Verificare OTP */}
      <div className="flex-1 flex flex-col justify-center py-12 px-8 sm:px-16 lg:px-24 xl:px-32 bg-white relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="mb-8 lg:hidden">
            <Building2 className="w-12 h-12 text-buildorange mb-4" />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Verifică-ți contul</h2>
          <p className="text-slate-500 mt-2 mb-8">
            Am trimis un cod de 6 cifre pe adresa de email <br/>
            <span className="font-semibold text-slate-800">{email}</span>
          </p>

          <form onSubmit={handleVerify} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded-r-md">
                {successMsg}
              </div>
            )}

            <Input
              label="Cod de verificare (OTP)"
              name="otp"
              type="text"
              icon={<KeyRound className="w-5 h-5" />}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="text-center text-2xl tracking-widest font-mono"
            />

            <Button type="submit" className="w-full mt-4" size="lg" isLoading={isLoading} disabled={otp.length !== 6}>
              Confirmă Codul
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600 mb-2">Nu ai primit emailul?</p>
            <button
              onClick={handleResend}
              disabled={countdown > 0 || isResending}
              className={`text-sm font-medium transition-colors ${
                countdown > 0 
                  ? 'text-slate-400 cursor-not-allowed' 
                  : 'text-buildorange hover:text-orange-700'
              }`}
            >
              {isResending 
                ? 'Se trimite...' 
                : countdown > 0 
                  ? `Retrimite cod în ${countdown}s` 
                  : 'Retrimite codul'}
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Dorești să folosești o altă adresă?{' '}
            <Link to="/register" className="font-medium text-slate-900 hover:text-buildorange transition-colors">
              Întoarce-te la Înregistrare
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
