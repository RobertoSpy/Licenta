import { HardHat, Star, MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

// Date mockate pentru sectiunea de experti (firme de constructii)
const expertsList = [
  {
    id: 1,
    name: "Construct Constructii Premium S.R.L.",
    rating: 4.8,
    reviews: 124,
    location: "București, Ilfov",
    priceRange: "Mijlocie/Ridicata",
    projectsCompleted: 89,
    tags: ["Echipa Mare", "Case la Roșu", "Finisaje"]
  },
  {
    id: 2,
    name: "Edificia Structuri",
    rating: 4.9,
    reviews: 56,
    location: "Cluj-Napoca",
    priceRange: "Ridicata",
    projectsCompleted: 42,
    tags: ["Structură de rezistență", "Case Pasive"]
  },
  {
    id: 3,
    name: "Meșterul Local S.R.L.",
    rating: 4.5,
    reviews: 210,
    location: "Național",
    priceRange: "Accesibila",
    projectsCompleted: 312,
    tags: ["Construcții Generale", "Fundații"]
  },
  {
    id: 4,
    name: "Smart Build Solutions",
    rating: 4.7,
    reviews: 88,
    location: "Timișoara",
    priceRange: "Mijlocie",
    projectsCompleted: 64,
    tags: ["Case Inteligente", "Lemn și Beton"]
  }
];

export const Experts = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Experți Construcții</h1>
        <p className="text-slate-500 mt-1">Colaborează cu echipe de top și firme validate pentru implementarea proiectului tău.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {expertsList.map((expert) => (
          <div key={expert.id} className="bg-white border border-slate-200 p-6 rounded-2xl hover:shadow-lg transition-all flex flex-col">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                  <HardHat className="w-7 h-7 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg leading-tight">{expert.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
                    <MapPin className="w-4 h-4" /> {expert.location}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-bold">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" /> {expert.rating.toFixed(1)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {expert.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">PROIECTE COMPLETAE</p>
                <p className="font-bold text-slate-900 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> {expert.projectsCompleted} verificate
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">GAMĂ DE PREȚ</p>
                <p className="font-bold text-slate-900">{expert.priceRange}</p>
              </div>
            </div>

            <Button className="w-full mt-auto">Vizionează Portofoliu &amp; Contact</Button>
          </div>
        ))}
      </div>
    </div>
  );
};
