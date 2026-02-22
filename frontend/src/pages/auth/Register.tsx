import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Lock, Mail, User } from 'lucide-react';
import { motion } from 'framer-motion';

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Logica pentru calculul puterii parolei
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return score;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0: return 'bg-slate-200';
      case 1: return 'bg-red-400';
      case 2: return 'bg-orange-400';
      case 3: return 'bg-yellow-400';
      case 4: return 'bg-green-500';
      default: return 'bg-slate-200';
    }
  };

  const getStrengthText = (score: number) => {
    switch (score) {
      case 0: return '';
      case 1: return 'Foarte Slabă';
      case 2: return 'Slabă';
      case 3: return 'Medie';
      case 4: return 'Puternică';
      default: return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (passwordStrength < 4) {
      setError('Parola trebuie să fie puternică (minim 8 caractere, o literă mare, o cifră și un simbol special).');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Parolele nu se potrivesc.');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      // După înregistrare, redirecționăm către login
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Înregistrarea a eșuat. Această adresă ar putea fi deja folosită.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Partea stângă - Variație a UI-ului arhitectural */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply z-10" />
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2000&auto=format&fit=crop"
          alt="Modern Architecture"
          className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-1000"
        />
        <div className="relative z-20 flex flex-col justify-end h-full p-20 text-white pb-32">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Digitalizarea șantierului tău începe aici
            </h2>
            <div className="w-20 h-1 bg-buildorange mb-6"></div>
            <p className="text-lg text-slate-300 max-w-lg">
              Alătură-te sutelor de profesioniști și alege cele mai bune materiale pentru proiectele tale imobiliare.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Partea dreaptă - Formularul de Înregistrare */}
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

          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Creează cont nou</h2>
          <p className="text-slate-500 mt-2 mb-8">Obține acces complet la planificatorul nostru 3D și prețurile actualizate.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md">
                {error}
              </div>
            )}

            <Input
              label="Nume Complet"
              name="name"
              type="text"
              icon={<User className="w-5 h-5" />}
              placeholder="ex. Ion Popescu"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <Input
              label="Adresă Email"
              name="email"
              type="email"
              icon={<Mail className="w-5 h-5" />}
              placeholder="arhitect@companie.ro"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Parolă"
                  name="password"
                  type="password"
                  icon={<Lock className="w-5 h-5" />}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Confirmare"
                  name="confirmPassword"
                  type="password"
                  icon={<Lock className="w-5 h-5" />}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Indicator Putere Parolă */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500 font-medium tracking-wide">Putere parolă:</span>
                    <span className={`text-xs font-bold ${getStrengthColor(passwordStrength).replace('bg-', 'text-')}`}>
                      {getStrengthText(passwordStrength)}
                    </span>
                  </div>
                  <div className="flex gap-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`flex-1 transition-all duration-300 ${index <= passwordStrength ? getStrengthColor(passwordStrength) : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                    *Minim 8 caractere. Trebuie să conțină o literă mare, o cifră și un simbol special (!@#$%^&*).
                  </p>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full mt-4" size="lg" isLoading={isLoading} disabled={passwordStrength < 4}>
              Creează Cont
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Ai deja un cont?{' '}
            <Link to="/login" className="font-medium text-buildorange hover:text-orange-700 transition-colors">
              Intră în cont
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
