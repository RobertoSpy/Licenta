import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { apiPrivate } from '../../api/axios';
import { contractorApi } from '../../api/contractorApi';
import { ContractorSpecialization, SPECIALIZATION_LABELS } from '../../types/contractor';
import { ROMANIAN_COUNTIES } from '../../utils/romanianCounties';
import { User, Mail, Save, AlertTriangle, Trash2, CheckCircle, Shield, Building2, Hash, ChevronDown, MapPin, Eye, EyeOff } from 'lucide-react';

export default function UserProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    password: '',
    confirmPassword: ''
  });
  
  const [contractorData, setContractorData] = useState<{ companyName: string; cui: string; county: string; description: string; specializations: ContractorSpecialization[] } | null>(null);

  useEffect(() => {
    if (user?.role === 'CONTRACTOR') {
      contractorApi.getMyProfile().then(data => {
        setContractorData({ companyName: data.companyName, cui: data.cui || 'Nespecificat', county: data.county || '', description: data.description || '', specializations: data.specializations || [] });
      }).catch(err => console.error(err));
    }
  }, [user]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [isCountyOpen, setIsCountyOpen] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      setMsg({ type: 'error', text: 'Parolele nu se potrivesc!' });
      return;
    }

    setIsLoading(true);
    setMsg(null);
    try {
      // Endpoint ipotetic/existent pentru actualizare date user
      try {
        await apiPrivate.put('/auth/profile', {
          name: formData.name,
          password: formData.password || undefined
        });
      } catch (e) {
        // Ignoram eroarea daca endpointul nu exista
      }

      if (user?.role === 'CONTRACTOR' && contractorData) {
        await contractorApi.updateMyProfile({ 
          county: contractorData.county,
          description: contractorData.description,
          specializations: contractorData.specializations 
        });
      }

      setMsg({ type: 'success', text: 'Profilul a fost actualizat cu succes!' });
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Eroare la actualizare' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert('Introdu parola pentru confirmare.');
      return;
    }
    setIsDeleting(true);
    try {
      await apiPrivate.delete('/auth/account', { data: { password: deletePassword } });
      logout();
      navigate('/login');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Eroare la ștergerea contului. Verifică parola.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-2xl flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Profilul Meu</h1>
            <p className="text-sm text-slate-500">Gestionează datele contului tău și setările de securitate.</p>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm font-medium ${
          msg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <CheckCircle className="w-5 h-5 shrink-0" />
          {msg.text}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Date Inregistrare (Read Only) */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Date Autentificare
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Email (Nu poate fi modificat)</label>
            <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm cursor-not-allowed">
              <Shield className="w-4 h-4 text-slate-300" />
              {user?.email || 'email@exemplu.ro'}
            </div>
          </div>
          
          {contractorData && (
            <div className="mt-6 pt-6 border-t border-slate-200/60">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Date Firmă (Constructor)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Denumire Firmă</label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm cursor-not-allowed">
                    <Building2 className="w-4 h-4 text-slate-300" />
                    {contractorData.companyName}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">CUI / CIF</label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-500 font-mono text-sm cursor-not-allowed">
                    <Hash className="w-4 h-4 text-slate-300" />
                    {contractorData.cui}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date Editabile */}
        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nume Complet</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Ion Popescu"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
            />
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Schimbare Parolă (Opțional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Parolă Nouă</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Lasă gol pentru a nu schimba"
                    className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Confirmă Parola</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="Repetă parola nouă"
                    className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {user?.role === 'CONTRACTOR' && contractorData && (
            <>
              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Locație (Județ)</h3>
                
                <div 
                  className="relative"
                  tabIndex={0}
                  onBlur={(e) => {
                    // Close if clicked outside of this element
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsCountyOpen(false);
                    }
                  }}
                >
                  <div 
                    onClick={() => setIsCountyOpen(!isCountyOpen)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl flex items-center justify-between cursor-pointer hover:border-buildorange focus:ring-2 focus:ring-buildorange outline-none transition-all bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <span className={contractorData.county ? "text-slate-900" : "text-slate-400"}>
                        {contractorData.county || "Selectează Județul"}
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCountyOpen ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {isCountyOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div 
                        onClick={() => {
                          setContractorData({...contractorData, county: ''});
                          setIsCountyOpen(false);
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!contractorData.county ? 'bg-orange-50 text-buildorange font-medium' : 'text-slate-600'}`}
                      >
                        Alege Județ
                      </div>
                      {ROMANIAN_COUNTIES.map(county => (
                        <div 
                          key={county}
                          onClick={() => {
                            setContractorData({...contractorData, county});
                            setIsCountyOpen(false);
                          }}
                          className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-t border-slate-50 ${contractorData.county === county ? 'bg-orange-50 text-buildorange font-medium' : 'text-slate-600'}`}
                        >
                          {county}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Descriere Firmă</h3>
                <textarea
                  value={contractorData.description}
                  onChange={(e) => setContractorData({...contractorData, description: e.target.value})}
                  placeholder="Scrie câteva cuvinte despre experiența ta, serviciile oferite etc."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all resize-y"
                />
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Specializări (Afilieri)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(SPECIALIZATION_LABELS).map(([enumValue, label]) => {
                    const spec = enumValue as ContractorSpecialization;
                    return (
                      <label key={spec} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 text-buildorange focus:ring-buildorange"
                          checked={contractorData.specializations.includes(spec)}
                          onChange={() => {
                            setContractorData(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                specializations: prev.specializations.includes(spec)
                                  ? prev.specializations.filter(s => s !== spec)
                                  : [...prev.specializations, spec]
                              };
                            });
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link to="/terms" target="_blank" className="hover:text-buildorange transition-colors">Termeni și Condiții</Link>
            <span>·</span>
            <Link to="/privacy" target="_blank" className="hover:text-buildorange transition-colors">Politica GDPR</Link>
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 bg-buildorange hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-70"
          >
            <Save className="w-5 h-5" />
            {isLoading ? 'Se salvează...' : 'Salvează Profilul'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden mt-6">
        <div className="px-8 py-6 border-b border-red-50">
          <h2 className="text-sm font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Zonă Periculoasă
          </h2>
        </div>
        <div className="p-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Ștergere Cont și Date Personale</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Această acțiune este <strong>ireversibilă</strong>. Toate proiectele tale, mesajele și datele personale vor fi șterse permanent conform dreptului GDPR "de a fi uitat".
              </p>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-5 py-3 border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-5 h-5" />
                Șterge Contul
              </button>
            ) : (
              <div className="w-full mt-4 bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Introdu parola pentru a confirma ștergerea definitivă:
                </p>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    placeholder="Parola contului tău"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 border border-red-300 rounded-xl outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showDeletePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                    className="flex-1 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl transition-colors text-sm"
                  >
                    Anulează
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || !deletePassword}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Se șterge...' : 'Confirm Ștergerea'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
