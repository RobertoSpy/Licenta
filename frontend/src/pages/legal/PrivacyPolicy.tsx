/**
 * frontend/src/pages/legal/PrivacyPolicy.tsx
 * Politica de Confidențialitate (GDPR) — pagină statică, accesibilă public
 */

import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Shield, Eye, Database, UserX, Globe, Lock, Mail } from 'lucide-react';

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-buildorange p-1.5 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Zidario</span>
          </Link>
          <Link to="/register" className="flex items-center gap-2 text-slate-600 hover:text-buildorange transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Înapoi la Înregistrare
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">GDPR</p>
              <h1 className="text-3xl font-black text-slate-900">Politica de Confidențialitate</h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm">Ultima actualizare: Iunie 2026 · Conformă cu RGPD / GDPR (Regulamentul UE 2016/679)</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">

        {/* Rights banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h2 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Drepturile Tale GDPR (Rezumat)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Dreptul de acces', desc: 'Poți solicita o copie a datelor tale' },
              { label: 'Dreptul la rectificare', desc: 'Poți corecta datele incorecte' },
              { label: 'Dreptul la ștergere', desc: '"Dreptul de a fi uitat"' },
              { label: 'Dreptul la portabilitate', desc: 'Primești datele în format structurat' },
              { label: 'Dreptul de opoziție', desc: 'Te poți opune prelucrării' },
              { label: 'Dreptul la restricție', desc: 'Poți limita prelucrarea' },
            ].map(right => (
              <div key={right.label} className="bg-white rounded-xl p-3 border border-blue-100">
                <p className="text-xs font-bold text-blue-800 mb-1">{right.label}</p>
                <p className="text-xs text-slate-500">{right.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {[
          {
            icon: <Database className="w-5 h-5" />,
            color: 'text-blue-600 bg-blue-50',
            title: '1. Ce Date Colectăm',
            content: `Colectăm doar datele necesare furnizării serviciilor: (a) Date de identificare: nume, adresă de email, parolă (stocată criptat cu bcrypt); (b) Date profesionale (pentru constructori): denumire firmă, CUI, județ, specializări; (c) Date despre proiecte: dimensiuni, locație generală, materialele selectate; (d) Date tehnice: adresa IP, tipul browserului, loguri de sesiune.`
          },
          {
            icon: <Shield className="w-5 h-5" />,
            color: 'text-emerald-600 bg-emerald-50',
            title: '2. Scopul Prelucrării',
            content: `Datele sunt prelucrate pentru: furnizarea și îmbunătățirea serviciilor platformei; autentificarea și securizarea contului; trimiterea notificărilor esențiale (verificare email, resetare parolă); conectarea clienților cu constructori relevanți; analiza anonimizată a tendințelor de utilizare.`
          },
          {
            icon: <Lock className="w-5 h-5" />,
            color: 'text-purple-600 bg-purple-50',
            title: '3. Securitatea Datelor',
            content: `Implementăm măsuri tehnice și organizatorice adecvate: parolele sunt criptate cu bcrypt (salt factor 10); comunicațiile sunt securizate prin HTTPS/TLS; accesul la baza de date este restricționat și monitorizat; sesiunile sunt gestionate prin JWT cu expirare automată; backup-urile sunt realizate regulat.`
          },
          {
            icon: <Globe className="w-5 h-5" />,
            color: 'text-orange-600 bg-orange-50',
            title: '4. Partajarea Datelor',
            content: `Nu vindem datele dvs. terților. Datele pot fi partajate cu: constructorii selectați de dvs. (date de contact pentru colaborare); furnizorii de servicii esențiale (hosting, email); autorități competente, exclusiv la solicitare legală. Profilele constructorilor sunt publice pe platformă și vizibile altor utilizatori autentificați.`
          },
          {
            icon: <UserX className="w-5 h-5" />,
            color: 'text-red-600 bg-red-50',
            title: '5. Retenția și Ștergerea Datelor',
            content: `Datele sunt păstrate pe durata contractului și 3 ani după închiderea contului (obligație legală contabilă). La cererea dvs., contul poate fi șters din secțiunea "Profilul Meu → Șterge Cont". Ștergerea elimină: profilul, proiectele, ofertele și datele personale. Datele anonimizate statistice pot fi păstrate pentru analize.`
          },
        ].map((section) => (
          <section key={section.title} className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${section.color}`}>
                {section.icon}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">{section.content}</p>
          </section>
        ))}

        {/* Cookies */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center text-lg">
              🍪
            </div>
            <h2 className="text-xl font-bold text-slate-900">6. Cookie-uri</h2>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Esențiale', desc: 'Sesiune de autentificare (JWT), preferințe UI. Necesare pentru funcționarea platformei.', required: true },
              { name: 'Analitice', desc: 'Date anonimizate despre utilizarea platformei, pentru îmbunătățirea serviciului.', required: false },
            ].map(cookie => (
              <div key={cookie.name} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                <div className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${cookie.required ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{cookie.name} {cookie.required && <span className="text-xs text-slate-500 font-normal">(obligatorii)</span>}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{cookie.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact DPO */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-buildorange/10 text-buildorange rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">7. Contact & DPO</h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            Responsabilul cu protecția datelor (DPO) poate fi contactat la <strong>dpo@zidario.ro</strong>.
            Aveți dreptul de a depune o plângere la <strong>ANSPDCP</strong> (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal) — <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-buildorange hover:underline">www.dataprotection.ro</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
