import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, Lock, Mail, User, ChevronDown, MapPin, Phone, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ContractorSpecialization, SPECIALIZATION_LABELS } from '../../types/contractor';
import { ROMANIAN_COUNTIES } from '../../utils/romanianCounties';

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'CLIENT', // 'CLIENT' | 'CONTRACTOR'
    companyName: '',
    cui: '',
    county: '',
    specializations: [] as ContractorSpecialization[]
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isCountyOpen, setIsCountyOpen] = useState(false);
  const [acceptedGdpr, setAcceptedGdpr] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    if (!acceptedTerms || !acceptedGdpr) {
      setError('Trebuie să accepți Termenii și Condițiile și Politica de Confidențialitate (GDPR) pentru a continua.');
      setIsLoading(false);
      return;
    }

    try {
      if (formData.role === 'CONTRACTOR') {
        if (!formData.companyName || !formData.cui || !formData.county) {
          setError('Firma, CUI-ul și Județul sunt obligatorii pentru constructori.');
          setIsLoading(false);
          return;
        }
        if (formData.specializations.length === 0) {
          setError('Te rugăm să alegi cel puțin o specializare (filieră).');
          setIsLoading(false);
          return;
        }
        await api.post('/auth/register-contractor', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          cui: formData.cui,
          county: formData.county,
          specializations: formData.specializations,
          coverageRadius: 50
        });
      } else {
        await api.post('/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
      }
      
      // După înregistrare, redirecționăm către ecranul de verificare email
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Înregistrarea a eșuat. Această adresă ar putea fi deja folosită.');
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
        <Link to="/" className="absolute top-8 left-8 sm:left-16 lg:left-24 xl:left-32 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-buildorange transition-colors">
          <ArrowLeft className="w-4 h-4" /> Înapoi acasă
        </Link>
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

            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'CLIENT' })}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-colors ${
                  formData.role === 'CLIENT' 
                    ? 'border-buildorange bg-orange-50 text-buildorange' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Sunt Client
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'CONTRACTOR' })}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-colors ${
                  formData.role === 'CONTRACTOR' 
                    ? 'border-buildorange bg-orange-50 text-buildorange' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Sunt Constructor
              </button>
            </div>

            <Input
              label="Nume Complet"
              name="name"
              type="text"
              icon={<User className="w-5 h-5" />}
              placeholder={formData.role === 'CONTRACTOR' ? 'Nume Reprezentant' : 'ex. Ion Popescu'}
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

            <Input
              label="Număr Telefon"
              name="phone"
              type="tel"
              icon={<Phone className="w-5 h-5" />}
              placeholder="ex. 0722123456"
              value={formData.phone}
              onChange={handleChange}
              required
            />

            {formData.role === 'CONTRACTOR' && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700">Detalii Firmă</h4>
                <Input
                  label="Denumire Firmă"
                  name="companyName"
                  type="text"
                  icon={<Building2 className="w-5 h-5" />}
                  placeholder="SC Construct SRL"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="CUI / CIF"
                    name="cui"
                    type="text"
                    placeholder="RO123456"
                    value={formData.cui}
                    onChange={handleChange}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Județ</label>
                    <div 
                      className="relative"
                      tabIndex={0}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setIsCountyOpen(false);
                        }
                      }}
                    >
                      <div 
                        onClick={() => setIsCountyOpen(!isCountyOpen)}
                        className={`w-full px-4 py-[9px] border ${isCountyOpen ? 'border-buildorange ring-2 ring-buildorange/20' : 'border-slate-300'} rounded-lg flex items-center justify-between cursor-pointer hover:border-buildorange transition-all bg-white`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className={formData.county ? "text-slate-900 text-sm" : "text-slate-400 text-sm"}>
                            {formData.county || "Alege Județ"}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCountyOpen ? 'rotate-180' : ''}`} />
                      </div>
                      
                      {isCountyOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          <div 
                            onClick={() => {
                              setFormData({...formData, county: ''});
                              setIsCountyOpen(false);
                            }}
                            className={`px-4 py-2 cursor-pointer text-sm hover:bg-slate-50 transition-colors ${!formData.county ? 'bg-orange-50 text-buildorange font-medium' : 'text-slate-600'}`}
                          >
                            Alege Județ
                          </div>
                          {ROMANIAN_COUNTIES.map(county => (
                            <div 
                              key={county}
                              onClick={() => {
                                setFormData({...formData, county});
                                setIsCountyOpen(false);
                              }}
                              className={`px-4 py-2 cursor-pointer text-sm hover:bg-slate-50 transition-colors border-t border-slate-50 ${formData.county === county ? 'bg-orange-50 text-buildorange font-medium' : 'text-slate-600'}`}
                            >
                              {county}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Specializări (poți alege mai multe)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SPECIALIZATION_LABELS).map(([enumValue, label]) => {
                      const spec = enumValue as ContractorSpecialization;
                      return (
                        <label key={spec} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                          <input 
                            type="checkbox"
                            className="rounded border-slate-300 text-buildorange focus:ring-buildorange"
                            checked={formData.specializations.includes(spec)}
                            onChange={() => {
                              if (spec === 'CONSTRUCTII_GENERALE') {
                                const isChecked = !formData.specializations.includes(spec);
                                if (isChecked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    specializations: Object.keys(SPECIALIZATION_LABELS) as ContractorSpecialization[]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    specializations: []
                                  }));
                                }
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  specializations: prev.specializations.includes(spec)
                                    ? prev.specializations.filter(s => s !== spec && s !== 'CONSTRUCTII_GENERALE')
                                    : [...prev.specializations, spec]
                                }));
                              }
                            }}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

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

            {/* GDPR & Terms Checkboxes */}
            <div className="space-y-3 pt-2 pb-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-buildorange focus:ring-buildorange"
                />
                <span className="text-sm text-slate-600 leading-snug">
                  Am citit și sunt de acord cu{' '}
                  <Link to="/terms" target="_blank" className="font-semibold text-buildorange hover:underline">
                    Termenii și Condițiile
                  </Link>
                  {' '}de utilizare.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedGdpr}
                  onChange={e => setAcceptedGdpr(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-buildorange focus:ring-buildorange"
                />
                <span className="text-sm text-slate-600 leading-snug">
                  Am luat la cunoștință{' '}
                  <Link to="/privacy" target="_blank" className="font-semibold text-buildorange hover:underline">
                    Politica de Confidențialitate (GDPR)
                  </Link>
                  {' '}și sunt de acord cu prelucrarea datelor mele personale.
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full mt-4" size="lg" isLoading={isLoading} disabled={passwordStrength < 4 || !acceptedTerms || !acceptedGdpr}>
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
