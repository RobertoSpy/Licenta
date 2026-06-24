export const MATERIAL_CATEGORIES = [
  'Fundație',
  'Structură',
  'Termoizolație',
  'Acoperiș',
  'Tâmplărie',
  'Finisaje Brute',
  'Finisaje Fine',
  'Instalații'
] as const;

export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];

export const MATERIAL_SUBCATEGORIES: Record<MaterialCategory, string[]> = {
  'Fundație': [
    'Săpătură și Terasamente',
    'Beton Fundație',
    'Oțel Beton Fundație',
    'Hidroizolație Fundație',
    'Cofraj Fundație'
  ],
  'Structură': [
    'Pereți exteriori',   // 💡 Updatat: Sincronizat cu wall_exterior (BCA / Porotherm 38)
    'Pereți interiori',   // 💡 Updatat: Sincronizat cu wall_interior (Cărămidă 12.5 / BCA 12.5)
    'Beton Structură',
    'Oțel Beton Structură',
    'Mortar Zidărie'
  ],
  'Termoizolație': [
    'Polistiren (EPS/XPS)',
    'Vată Minerală',
    'Accesorii Fațadă'    // 💡 Updatat: Sincronizat cu etics_mesh și etics_finish (Plasă / Tencuială)
  ],
  'Acoperiș': [
    'Învelitoare Ceramică',
    'Învelitoare Metalică',
    'Învelitoare Beton',
    'Structură Lemn Acoperiș',
    'Hidroizolație Acoperiș'
  ],
  'Tâmplărie': [
    'Fereastră PVC',
    'Fereastră Aluminiu',
    'Fereastră Lemn',
    'Ușă Exterior'
  ],
  'Finisaje Brute': [
    'Șapă',
    'Tencuială',
    'Glet',
    'Vopsea Lavabilă'     // 💡 Updatat: Sincronizat cu paint_interior, mutat din Fine în Brute conform formulei!
  ],
  'Finisaje Fine': [
    'Parchet',
    'Gresie',
    'Faianță',
    'Uși Interior'
  ],
  'Instalații': [
    'Cablu Prize',
    'Cablu Iluminat',
    'Tuburi și Copex',
    'Doze și Accesorii',
    'Aparataj (Prize/Întrerupătoare)',
    'Tablouri și Siguranțe',
    'Țevi Alimentare Apă',
    'Canalizare Interioară',
    'Obiecte Sanitare',
    'Echipamente Termice',
    'Încălzire în Pardoseală',
    'Calorifere'
  ]
};

export const ALL_SUBCATEGORIES = Object.values(MATERIAL_SUBCATEGORIES).flat();