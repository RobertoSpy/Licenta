import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Step 1: Enter OTP ──────────────────────────────────────────────────────
const OtpInput = ({
  value,
  onChange,
}: {
  value: string[];
  onChange: (val: string[]) => void;
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        const next = [...value];
        next[idx] = '';
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
      }
    }
  };

  const handleChange = (char: string, idx: number) => {
    if (!/^\d$/.test(char)) return;
    const next = [...value];
    next[idx] = char;
    onChange(next);
    if (idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...value];
    pasted.split('').forEach((char, i) => { next[i] = char; });
    onChange(next);
    const nextFocus = Math.min(pasted.length, 5);
    refs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e.target.value, idx)}
          onKeyDown={(e) => handleKey(e, idx)}
          onPaste={handlePaste}
          className={`
            w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none
            transition-all duration-200 bg-white
            ${digit
              ? 'border-buildorange text-slate-900 shadow-sm'
              : 'border-slate-200 text-slate-900 focus:border-buildorange focus:ring-2 focus:ring-buildorange/20'
            }
          `}
        />
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || '';

  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState(emailFromState);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otp = otpDigits.join('');

  // Countdown for resend
  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(interval); return 0; }
        return v - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    try {
      await api.post('/auth/forgot-password', { email });
      startCooldown();
    } catch { /* silently fail — same UX as initial request */ }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { setError('Introdu toate cele 6 cifre.'); return; }
    // We don't verify OTP separately; we verify it on final submit to reduce roundtrips.
    // Just advance to next step.
    setError('');
    setStep('password');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Parola trebuie să aibă minim 8 caractere.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError('Parola trebuie să conțină o literă mare, o cifră și un caracter special.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Parolele nu se potrivesc.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      navigate('/login', { state: { message: 'Parola a fost resetată cu succes. Te poți autentifica.' } });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Cod invalid sau expirat. Încearcă din nou.';
      setError(msg);
      if (msg.toLowerCase().includes('cod')) {
        setStep('otp'); // Trimite înapoi la OTP dacă codul e greșit
        setOtpDigits(['', '', '', '', '', '']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (() => {
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthColors = ['bg-slate-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  const strengthLabels = ['', 'Foarte Slabă', 'Slabă', 'Medie', 'Puternică'];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Panoul stâng */}
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
              Securitatea <span className="text-buildorange">contului</span> tău contează
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              Verificăm identitatea ta printr-un cod unic trimis pe email, pentru a ne asigura că numai tu poți reseta parola.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Panoul drept */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-white">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 lg:hidden">
            <Building2 className="w-12 h-12 text-buildorange mb-4" />
          </div>

          <Link to="/forgot-password" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-buildorange mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Înapoi
          </Link>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step === 'otp' || step === 'password' ? 'bg-buildorange' : 'bg-slate-200'}`} />
            <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step === 'password' ? 'bg-buildorange' : 'bg-slate-200'}`} />
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: OTP ── */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-8 h-8 text-buildorange" />
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Verificare Email</h2>
                </div>
                <p className="text-slate-500 mt-2 mb-8">
                  Am trimis un cod de 6 cifre la{' '}
                  <span className="font-semibold text-slate-700">{email || 'adresa ta de email'}</span>.
                  Introdu-l mai jos.
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {!emailFromState && (
                    <Input
                      label="Adresă Email"
                      type="email"
                      placeholder="arhitect@companie.ro"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-4">Codul de verificare</label>
                    <OtpInput value={otpDigits} onChange={setOtpDigits} />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" disabled={otp.length < 6}>
                    Verifică Codul
                  </Button>

                  <p className="text-center text-sm text-slate-500">
                    Nu ai primit codul?{' '}
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400">Retrimite în {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        className="font-medium text-buildorange hover:text-orange-700 transition-colors"
                      >
                        Retrimite
                      </button>
                    )}
                  </p>
                </form>
              </motion.div>
            )}

            {/* ── Step 2: New Password ── */}
            {step === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="w-8 h-8 text-buildorange" />
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Parolă Nouă</h2>
                </div>
                <p className="text-slate-500 mt-2 mb-8">
                  Alege o parolă puternică pentru a-ți proteja contul.
                </p>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  {error && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                      {error}
                    </div>
                  )}

                  <div>
                    <Input
                      label="Parolă Nouă"
                      type="password"
                      icon={<Lock className="w-5 h-5" />}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    {newPassword && (
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-slate-500">Putere parolă:</span>
                          <span className="text-xs font-bold text-slate-700">{strengthLabels[passwordStrength]}</span>
                        </div>
                        <div className="flex gap-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={`flex-1 transition-all duration-300 ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-transparent'}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    label="Confirmă Parola"
                    type="password"
                    icon={<Lock className="w-5 h-5" />}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    className="w-full mt-2"
                    size="lg"
                    isLoading={isLoading}
                    disabled={passwordStrength < 4}
                  >
                    Salvează Parola Nouă
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setStep('otp'); setError(''); }}
                    className="w-full text-sm text-slate-500 hover:text-buildorange transition-colors"
                  >
                    ← Modifică codul OTP
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
