/**
 * frontend/src/pages/legal/TermsAndConditions.tsx
 * Termeni și Condiții — pagină statică, accesibilă public
 */

import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Scale, Shield, AlertTriangle, FileText, Users, CreditCard, Phone } from 'lucide-react';

export const TermsAndConditions = () => {
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
            <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-buildorange uppercase tracking-widest">Juridic</p>
              <h1 className="text-3xl font-black text-slate-900">Termeni și Condiții</h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm">Ultima actualizare: Iunie 2026 · Versiunea 1.0</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Intro */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 leading-relaxed">
              Prin utilizarea platformei <strong>Zidario</strong>, confirmați că ați citit, înțeles și acceptat acești termeni și condiții. Dacă nu sunteți de acord, vă rugăm să nu utilizați platforma.
            </p>
          </div>
        </div>

        {/* Sections */}
        {[
          {
            icon: <FileText className="w-5 h-5" />,
            title: '1. Descrierea Serviciului',
            content: `Zidario este o platformă digitală destinată planificării, bugetării și gestionării proiectelor de construcții rezidențiale din România. Serviciile includ: generarea de devize (BOM - Bill of Materials), accesul la prețuri actualizate de materiale de construcții, planificarea 2D a locuințelor, conectarea cu constructori verificați și analiza indicilor de cost în construcții (date INSSE).`
          },
          {
            icon: <Users className="w-5 h-5" />,
            title: '2. Utilizatori și Roluri',
            content: `Platforma acceptă trei tipuri de utilizatori: (a) Clienți — persoane fizice sau juridice care doresc să construiască sau să renoveze; (b) Constructori — firme de construcții legal înregistrate în România, cu CUI valid; (c) Administratori — personal autorizat al Zidario. Conturile de constructor sunt supuse verificării administrative înainte de activare completă.`
          },
          {
            icon: <Shield className="w-5 h-5" />,
            title: '3. Obligațiile Utilizatorului',
            content: `Utilizatorii se obligă să: furnizeze informații corecte și actualizate; nu utilizeze platforma în scopuri ilegale sau frauduloase; nu reproducă, distribuie sau copieze conținutul platformei fără acord scris; respecte drepturile de autor și proprietatea intelectuală. Constructorii se obligă suplimentar să dețină toate autorizațiile necesare desfășurării activității de construcții în România.`
          },
          {
            icon: <AlertTriangle className="w-5 h-5" />,
            title: '4. Limitarea Răspunderii',
            content: `Zidario furnizează informații cu caracter orientativ. Prețurile materialelor, devizele generate și prognoze de piață au rol informativ și nu constituie oferte ferme. Zidario nu răspunde pentru decizii luate exclusiv pe baza informațiilor de pe platformă. Utilizatorii sunt responsabili pentru verificarea prețurilor cu furnizorii și obținerea autorizațiilor de construire.`
          },
          {
            icon: <CreditCard className="w-5 h-5" />,
            title: '5. Tarife și Plăți',
            content: `În faza curentă, accesul la platformă este gratuit pentru utilizatorii clienți. Funcționalitățile premium și accesul la marketplace-ul de constructori pot face obiectul unor taxe viitoare, care vor fi comunicate cu cel puțin 30 de zile înainte de intrarea în vigoare.`
          },
          {
            icon: <Scale className="w-5 h-5" />,
            title: '6. Jurisdicție și Legislație Aplicabilă',
            content: `Acești termeni sunt guvernați de legislația română. Orice litigiu va fi supus jurisdicției exclusive a instanțelor din România. Dacă o prevedere este declarată nulă, restul termenilor rămân valabili. Zidario își rezervă dreptul de a modifica acești termeni, notificând utilizatorii prin email.`
          },
        ].map((section) => (
          <section key={section.title} className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                {section.icon}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">{section.content}</p>
          </section>
        ))}

        {/* Contact */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-buildorange/10 text-buildorange rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">7. Contact</h2>
          </div>
          <p className="text-slate-600 text-sm">
            Pentru întrebări legate de acești termeni, vă puteți adresa la: <strong>contact@zidario.ro</strong>
          </p>
        </section>
      </div>
    </div>
  );
};
