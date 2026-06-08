/**
 * frontend/src/pages/contractor/ProfileEdit.tsx
 * Pagina de Profil a Constructorului — design premium alb, similar Login/Register.
 * Datele firmei sunt pre-completate din înregistrare (CUI, Județ, etc.)
 * Include: ștergere cont, GDPR, Termeni și Condiții.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { contractorApi, type ContractorProfile } from '../../api/contractorApi';
import { useAuth } from '../../context/useAuth';
import { apiPrivate } from '../../api/axios';
import {
  Building2, Save, CheckCircle, Shield, MapPin, Hash,
  AlertTriangle, Trash2, Star, Phone, Globe, Award, Lock, Eye, EyeOff
} from 'lucide-react';

export default function ProfileEdit() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Partial<ContractorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await contractorApi.getMyProfile();
        setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await contractorApi.updateMyProfile(profile);
      setMsg({ type: 'success', text: 'Profil actualizat cu succes!' });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Eroare la salvare. Încearcă din nou.' });
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-buildorange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-2xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Profilul Firmei</h1>
            <p className="text-sm text-slate-500">{user?.name} · {profile.companyName}</p>
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

      {/* Main Form Card */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Section: Date Firmă (read-only din înregistrare) */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4" /> Date Firmă (din înregistrare)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">CUI / CIF</label>
              <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-sm">
                <Lock className="w-4 h-4 text-slate-300" />
                {profile.cui || 'Nespecificat'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Județ Principal</label>
              <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm">
                <MapPin className="w-4 h-4 text-slate-300" />
                {profile.county || 'Nespecificat'}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            CUI-ul nu poate fi modificat. Contactează suportul dacă datele sunt incorecte.
          </p>
        </div>

        {/* Section: Profil Public */}
        <div className="p-8 space-y-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Globe className="w-4 h-4" /> Profil Public (vizibil clienților)
          </h2>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Denumire Firmă</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
                value={profile.companyName || ''}
                onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                placeholder="SC Construct SRL"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Descriere Firmă</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all resize-none"
              value={profile.description || ''}
              onChange={e => setProfile({ ...profile, description: e.target.value })}
              placeholder="Descrie experiența, serviciile și avantajele companiei tale..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rază Deplasare (km)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
                  value={profile.coverageRadius || 50}
                  onChange={e => setProfile({ ...profile, coverageRadius: Number(e.target.value) })}
                  min={5} max={500}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Ani Experiență</label>
              <div className="relative">
                <Award className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-buildorange outline-none transition-all"
                  value={profile.yearsExperience || ''}
                  onChange={e => setProfile({ ...profile, yearsExperience: Number(e.target.value) })}
                  min={0} max={100}
                  placeholder="ex: 10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Read-Only */}
        <div className="px-8 pb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-200">
              <p className="text-2xl font-black text-slate-900">{profile.completedProjects ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Proiecte Finalizate</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-200">
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-black text-slate-900">{profile.avgRating ? profile.avgRating.toFixed(1) : '—'}</p>
                <Star className="w-5 h-5 text-amber-400 fill-current" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Rating Mediu</p>
            </div>
            <div className={`rounded-2xl p-4 text-center border ${profile.isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-center">
                <Shield className={`w-7 h-7 ${profile.isVerified ? 'text-emerald-500' : 'text-amber-400'}`} />
              </div>
              <p className={`text-xs font-semibold mt-1 ${profile.isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                {profile.isVerified ? 'Verificat' : 'În așteptare verificare'}
              </p>
            </div>
          </div>
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
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-buildorange hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-70"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Se salvează...' : 'Salvează Profilul'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-red-50">
          <h2 className="text-sm font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Zonă Periculoasă
          </h2>
        </div>
        <div className="p-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Ștergere Cont și Date</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Această acțiune este <strong>ireversibilă</strong>. Contul, profilul firmei, ofertele și toate datele personale vor fi șterse permanent conform dreptului GDPR "de a fi uitat".
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
