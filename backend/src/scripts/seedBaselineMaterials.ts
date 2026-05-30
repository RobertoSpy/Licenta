import { PrismaClient } from '@prisma/client';
import { scraperService } from '../services/scraperService';

const prisma = new PrismaClient();

interface BaselineMaterial {
  internalCode: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  pricePerUnit: number; // RON, estimativ 2024
  description: string;
  isDefault: boolean;
  storeUrl?: string;
}

const BASELINE_MATERIALS: BaselineMaterial[] = [
  // ── FUNDAȚIE (Beton, Armătură, Hidroizolație) ──────────────────────────────────
  {
    internalCode: 'STANDARD_BETON_C20_25',
    name: 'Beton C20/25 (B250)',
    category: 'Fundație', subcategory: 'Beton', unit: 'mc', pricePerUnit: 420,
    description: 'Standard pentru zone cu ag≤0.20g. Clasa XC2.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/beton/c'
  },
  {
    internalCode: 'STANDARD_BETON_C25_30',
    name: 'Beton C25/30 (B300)',
    category: 'Fundație', subcategory: 'Beton', unit: 'mc', pricePerUnit: 465,
    description: 'Recomandat pentru zone seismice ag≥0.25g sau îngheț sever. Clasa XF2.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/beton/c'
  },
  {
    internalCode: 'STANDARD_BETON_C30_37',
    name: 'Beton C30/37 (B400)',
    category: 'Fundație', subcategory: 'Beton', unit: 'mc', pricePerUnit: 510,
    description: 'Zone seismice severe + sol slab.',
    isDefault: false,
  },
  {
    internalCode: 'STANDARD_FIER_10',
    name: 'Fier beton PC52 Ø10mm',
    category: 'Fundație', subcategory: 'Armătură', unit: 'kg', pricePerUnit: 4.10,
    description: 'Fundații ușoare, P fără etaj.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/otel-beton/c'
  },
  {
    internalCode: 'STANDARD_FIER_12',
    name: 'Fier beton PC52 Ø12mm',
    category: 'Fundație', subcategory: 'Armătură', unit: 'kg', pricePerUnit: 4.20,
    description: 'Standard P+1. Bare longitudinale fundații, armătură centuri.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/otel-beton/c'
  },
  {
    internalCode: 'STANDARD_FIER_14',
    name: 'Fier beton PC60 Ø14mm',
    category: 'Fundație', subcategory: 'Armătură', unit: 'kg', pricePerUnit: 4.30,
    description: 'P+2, zone seismice 0.30g+.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/otel-beton/c'
  },
  {
    internalCode: 'HIDROIZOLATIE_3MM',
    name: 'Membrană bituminoasă 3mm',
    category: 'Fundație', subcategory: 'Hidroizolație', unit: 'mp', pricePerUnit: 15,
    description: 'Hidroizolație standard pentru fundații.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/membrana-bituminoasa/c'
  },
  {
    internalCode: 'HIDROIZOLATIE_4MM_ARM',
    name: 'Membrană bituminoasă 4mm armată',
    category: 'Fundație', subcategory: 'Hidroizolație', unit: 'mp', pricePerUnit: 25,
    description: 'Zone cu pânză freatică ridicată.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/membrana-bituminoasa/c'
  },
  {
    internalCode: 'STANDARD_PLACAJ_COFRARE',
    name: 'Placaj cofraj 18mm',
    category: 'Fundație', subcategory: 'Cofraj', unit: 'mp', pricePerUnit: 38,
    description: 'Placaj fenolic 18mm pentru cofrarea fețelor laterale.',
    isDefault: true,
  },

  // ── STRUCTURĂ ZIDĂRIE ────────────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_BCA_25',
    name: 'BCA Ytong 25cm D3',
    category: 'Structură', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 65,
    description: 'Ușor, izolant termic, recomandat ag≤0.25g, sol stabil.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/bca-ytong-a-250-mm/p/5015092'
  },
  {
    internalCode: 'BCA_YTONG_30',
    name: 'BCA Ytong 30cm D4',
    category: 'Structură', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 75,
    description: 'Mai gros, clasă energetică mai bună, recomandat climă rece.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/bca-ytong/c'
  },
  {
    internalCode: 'CARAMIDA_POROTHERM_30',
    name: 'Cărămidă Porotherm 30cm',
    category: 'Structură', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 80,
    description: 'Tradițional, mai rezistent seismic pe sol slab.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/caramida-porotherm/c'
  },
  {
    internalCode: 'CARAMIDA_POROTHERM_38',
    name: 'Cărămidă Porotherm 38cm',
    category: 'Structură', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 95,
    description: 'Pentru climă rece, izolație termică superioară din masă.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/caramida-porotherm/c'
  },
  {
    internalCode: 'STANDARD_BCA_12',
    name: 'BCA Ytong 12.5cm',
    category: 'Structură', subcategory: 'Pereți interiori', unit: 'mp', pricePerUnit: 38,
    description: 'Standard despărțitor, greutate redusă pe planșeu.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/bca-ytong/c'
  },
  {
    internalCode: 'CARAMIDA_12',
    name: 'Cărămidă 12.5cm',
    category: 'Structură', subcategory: 'Pereți interiori', unit: 'mp', pricePerUnit: 45,
    description: 'Mai bună izolație fonică între camere.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/caramida/c'
  },
  {
    internalCode: 'GIPS_CARTON_12',
    name: 'Gips-carton dublu 12.5cm',
    category: 'Structură', subcategory: 'Pereți interiori', unit: 'mp', pricePerUnit: 35,
    description: 'Execuție rapidă, pereți complet nestructurali.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/placi-gips-carton/c'
  },

  // ── TERMOIZOLAȚIE ────────────────────────────────────────────────────────────────
  {
    internalCode: 'polistiren-eps-10cm',
    name: 'Polistiren expandat EPS 10cm',
    category: 'Termoizolație', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 25,
    description: 'Ieftin, clasă C, conductivitate 0.040 W/mK.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/polistiren-expandat/c'
  },
  {
    internalCode: 'POLISTIREN_GRAFITAT_10',
    name: 'Polistiren grafitat EPS 10cm',
    category: 'Termoizolație', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 35,
    description: 'Mai eficient, clasă B, conductivitate 0.032 W/mK.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/polistiren-expandat/c'
  },
  {
    internalCode: 'VATA_MINERALA_EXT_10',
    name: 'Vată minerală bazaltică 10cm',
    category: 'Termoizolație', subcategory: 'Pereți exteriori', unit: 'mp', pricePerUnit: 60,
    description: 'Premium, clasa A, incombustibil (ignifug), izolație fonică superioară.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/vata-bazaltica/c'
  },
  {
    internalCode: 'vata-minerala-15cm',
    name: 'Vată minerală 15cm',
    category: 'Termoizolație', subcategory: 'Acoperiș', unit: 'mp', pricePerUnit: 55,
    description: 'Standard izolație pod/acoperiș.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/vata-minerala/c'
  },
  {
    internalCode: 'VATA_MINERALA_20',
    name: 'Vată minerală 20cm',
    category: 'Termoizolație', subcategory: 'Acoperiș', unit: 'mp', pricePerUnit: 75,
    description: 'Climă rece, nord, rezistență termică ridicată.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/vata-minerala/c'
  },

  // ── ACOPERIȘ ─────────────────────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_TIGLA_CERAMICA',
    name: 'Țiglă ceramică Tondach',
    category: 'Acoperiș', subcategory: 'Învelitoare', unit: 'mp', pricePerUnit: 75,
    description: 'Clasic, durabil >50 ani, greutate mare.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tigla-ceramica/c'
  },
  {
    internalCode: 'TIGLA_BETON_BRAMAC',
    name: 'Țiglă beton Bramac',
    category: 'Acoperiș', subcategory: 'Învelitoare', unit: 'mp', pricePerUnit: 60,
    description: 'Mai ieftină, durabil ~30 ani.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/tigla-beton/c'
  },
  {
    internalCode: 'TABLA_LINDAB',
    name: 'Tablă cutată Lindab',
    category: 'Acoperiș', subcategory: 'Învelitoare', unit: 'mp', pricePerUnit: 45,
    description: 'Modern, greutate redusă, rapid de montat.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/tigla-metalica/c'
  },
  {
    internalCode: 'STANDARD_LEMN_STRUCTURA',
    name: 'Lemn rășinos ecarisat 8×12cm',
    category: 'Acoperiș', subcategory: 'Structură', unit: 'mc', pricePerUnit: 1450,
    description: 'Standard pentru șarpante și căpriori.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/cherestea/c'
  },

  // ── TÂMPLĂRIE ────────────────────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_FEREASTRA_PVC',
    name: 'Ferestre PVC 2 geamuri Low-E',
    category: 'Tâmplărie', subcategory: 'Ferestre', unit: 'buc', pricePerUnit: 850,
    description: 'Buget mediu, Uw=1.1, standard termopan.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/ferestre-pvc/c'
  },
  {
    internalCode: 'FEREASTRA_PVC_3K',
    name: 'Ferestre PVC 3 geamuri (Tripan)',
    category: 'Tâmplărie', subcategory: 'Ferestre', unit: 'buc', pricePerUnit: 1200,
    description: 'Premium, Uw=0.7, clasă energetică A.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/ferestre-pvc/c'
  },
  {
    internalCode: 'FEREASTRA_ALUMINIU',
    name: 'Ferestre Aluminiu 3 geamuri',
    category: 'Tâmplărie', subcategory: 'Ferestre', unit: 'buc', pricePerUnit: 1800,
    description: 'Modern/industrial, profil rezistent, Uw=0.8.',
    isDefault: false,
  },
  {
    internalCode: 'STANDARD_USA_EXTERIOR',
    name: 'Ușă exterior PVC cu geam',
    category: 'Tâmplărie', subcategory: 'Uși exterior', unit: 'buc', pricePerUnit: 1800,
    description: 'Standard ușă de intrare rezidențială.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/usi-exterior/c'
  },

  // ── FINISAJE BRUTE ───────────────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_SAPA',
    name: 'Șapă ciment M100 5cm',
    category: 'Finisaje Brute', subcategory: 'Șapă', unit: 'mp', pricePerUnit: 28,
    description: 'Standard pentru nivelare pardoseală.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/sapa/c'
  },
  {
    internalCode: 'SAPA_AUTONIVELANTA',
    name: 'Șapă autonivelantă',
    category: 'Finisaje Brute', subcategory: 'Șapă', unit: 'mp', pricePerUnit: 40,
    description: 'Rapid de aplicat, finisaj perfect pentru parchet laminat subțire.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/sapa-autonivelanta/c'
  },
  {
    internalCode: 'STANDARD_TENCUIALA',
    name: 'Tencuială mecanizată',
    category: 'Finisaje Brute', subcategory: 'Tencuială', unit: 'mp', pricePerUnit: 22,
    description: 'Rapid, aplicare uniformă, necesită echipament.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tencuiala/c'
  },

  // ── FINISAJE FINE ────────────────────────────────────────────────────────────────
  {
    internalCode: 'PARCHET_8MM',
    name: 'Parchet laminat 8mm AC4',
    category: 'Finisaje Fine', subcategory: 'Pardoseli calde', unit: 'mp', pricePerUnit: 35,
    description: 'Buget redus, rezistență la trafic normal.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/parchet-laminat/c'
  },
  {
    internalCode: 'PARCHET_12MM',
    name: 'Parchet laminat 12mm AC5',
    category: 'Finisaje Fine', subcategory: 'Pardoseli calde', unit: 'mp', pricePerUnit: 60,
    description: 'Calitate medie spre premium, bun pentru încălzire în pardoseală.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/parchet-laminat/c'
  },
  {
    internalCode: 'PARCHET_MASIV',
    name: 'Parchet masiv stejar',
    category: 'Finisaje Fine', subcategory: 'Pardoseli calde', unit: 'mp', pricePerUnit: 250,
    description: 'Premium, aspect natural, durată lungă de viață.',
    isDefault: false,
  },
  {
    internalCode: 'GRESIE_60',
    name: 'Gresie porțelanată 60×60cm',
    category: 'Finisaje Fine', subcategory: 'Pardoseli reci', unit: 'mp', pricePerUnit: 65,
    description: 'Standard, format potrivit pentru băi și bucătării.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/gresie/c'
  },
  {
    internalCode: 'GRESIE_80',
    name: 'Gresie rectificată 80×80cm',
    category: 'Finisaje Fine', subcategory: 'Pardoseli reci', unit: 'mp', pricePerUnit: 120,
    description: 'Premium, rosturi minime, aspect modern și elegant.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/gresie/c'
  },
  {
    internalCode: 'STANDARD_USA_INTERIOR',
    name: 'Porta Doors furniruit',
    category: 'Finisaje Fine', subcategory: 'Uși interior', unit: 'buc', pricePerUnit: 550,
    description: 'Standard, ușor de asortat, rezistență medie.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/usi-interior/c'
  },
  {
    internalCode: 'USA_INTERIOR_MASIV',
    name: 'Porta Doors stejar masiv',
    category: 'Finisaje Fine', subcategory: 'Uși interior', unit: 'buc', pricePerUnit: 1400,
    description: 'Premium, fonoizolație bună, durabilitate mare.',
    isDefault: false,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── PREGĂTIRE FUNDAȚIE (balast, beton egalizare, bariere, primer) ─────────────
  // Sursă normativă: NP 112-2014 (fundații) + C169-88 (terasamente)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'BALAST_COMPACTAT',
    name: 'Balast 16-32mm compactat',
    category: 'Fundație', subcategory: 'Terasamente', unit: 'mc', pricePerUnit: 65,
    description: 'Pat de balast compactat 20cm sub fundație, obligatoriu conform NP 112-2014 Art.6.3 — asigură drenajul și distribuția uniformă a presiunii.',
    isDefault: true,
  },
  {
    internalCode: 'BETON_EGALIZARE_C8_10',
    name: 'Beton de egalizare C8/10',
    category: 'Fundație', subcategory: 'Beton', unit: 'mc', pricePerUnit: 280,
    description: 'Strat de regularizare 10cm sub fundație, obligatoriu conform NE 012-1:2022 §4.3 și NP 112-2014 Tab.3 — asigură suprafața plană pentru cofraje și hidroizolație.',
    isDefault: true,
  },
  {
    internalCode: 'FOLIE_PE_200_MICRONI',
    name: 'Folie polietilenă 200 microni',
    category: 'Fundație', subcategory: 'Hidroizolație', unit: 'mp', pricePerUnit: 3,
    description: 'Barieră de umiditate între teren și structura de beton, obligatorie conform NP 112-2014 Art.9.1 — protejează betonul de proasta umiditate a terenului înainte de hidroizolația propriu-zisă.',
    isDefault: true,
  },
  {
    internalCode: 'PRIMER_BITUMINOS',
    name: 'Primer bituminos (amorsă) Penetral MC',
    category: 'Fundație', subcategory: 'Hidroizolație', unit: 'mp', pricePerUnit: 4,
    description: 'Amorsă bituminoasă pe bază de solvent, aplicată obligatoriu înaintea membranei bituminoase conform NP 112-2014 Art.9.2 și instrucțiunilor tehnice C 112-86. Consum: 0.3 L/mp.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/amorsaj-bituminos/c',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── MORTAR ȘI ADEZIVI ZIDĂRIE ─────────────────────────────────────────────────
  // Sursă normativă: CR 6-2013 Cap.3 + SR EN 998-2:2016 (mortare zidărie)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'MORTAR_ZIDARIE_M10_SAC',
    name: 'Mortar zidărie M10 sac 25kg',
    category: 'Structură', subcategory: 'Mortar', unit: 'sac', pricePerUnit: 18,
    description: 'Mortar pentru utilizare generală (G) clasa M10 — prescripție CR 6-2013 Tab.3.1 (compoziție 1:2.5 ciment:nisip). Rost de 12mm conform CR 6-2013 §3.2.2(4). Standard pentru zidărie din cărămidă. 1 sac = ~12L mortar proaspăt.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/mortar-zidarie/c',
  },
  {
    internalCode: 'MORTAR_ZIDARIE_M5_SAC',
    name: 'Mortar zidărie M5 sac 25kg',
    category: 'Structură', subcategory: 'Mortar', unit: 'sac', pricePerUnit: 15,
    description: 'Mortar pentru utilizare generală (G) clasa M5 — CR 6-2013 Tab.3.1 (1:3 ciment:nisip). Utilizat la pereți interiori nestructurali sau zone cu cerințe seismice reduse (ag≤0.15g).',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/mortar-zidarie/c',
  },
  {
    internalCode: 'ADEZIV_BCA_YTONG_SAC',
    name: 'Adeziv rost subțire BCA Ytong 25kg',
    category: 'Structură', subcategory: 'Mortar', unit: 'sac', pricePerUnit: 22,
    description: 'Mortar adeziv (T — thin layer) pentru rost subțire 1-3mm, conform CR 6-2013 §3.2.2(3) și specificațiilor tehnice Ytong/Xella. Nisip fin <1mm, întărire rapidă. Consum: ~1.4 kg/mp zidărie față (vs 88 kg/mp la mortar G 25cm). AI sugerează override din mortar M10 când wall_exterior=BCA.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/adeziv-bca/c',
  },
  {
    internalCode: 'MORTAR_BETON_CELULAR_BAUMIT',
    name: 'Mortar beton celular Baumit PowerContact 25kg',
    category: 'Structură', subcategory: 'Mortar', unit: 'sac', pricePerUnit: 25,
    description: 'Adeziv performant pentru BCA și blocuri de beton celular, alternativă premium la ADEZIV_BCA_YTONG_SAC. Rost subțire 2-3mm. SR EN 998-2:2016 tip T. Rezistență la forfecare declarată ≥0.15 N/mm² (CR 6-2013 Tab.3.2).',
    isDefault: false,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── ȘARPANTĂ ȘI SISTEM PLUVIAL (accesorii lipsă) ─────────────────────────────
  // Sursă: CR 1-1-4-2012 Art.6 + specificații tehnice producători Tondach/Bramac
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'SIPCA_25X50MM',
    name: 'Șipcă rășinoasă 2.5×5cm',
    category: 'Acoperiș', subcategory: 'Structură', unit: 'ml', pricePerUnit: 2.5,
    description: 'Șipci suport învelitoare, distanță între ele 33cm (standard pentru țiglă ceramică Tondach — 13 cursuri/ml conform fișei tehnice). CR 1-1-4-2012 — structura de suport a învelitorii.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/cherestea/c',
  },
  {
    internalCode: 'FOLIE_ANTICONDENS_ACOPERIS',
    name: 'Folie difuzie vapori acoperiș (anticondens)',
    category: 'Acoperiș', subcategory: 'Hidroizolație', unit: 'mp', pricePerUnit: 8,
    description: 'Strat difuzie vapori sub învelitoare, obligatoriu pentru prevenirea condensului interstițial conform Mc-001-2022 §7.3 (performanță energetică) și SR EN 13859-1. Suprapunere minimă 10% la montat.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/folii-acoperis/c',
  },
  {
    internalCode: 'JGHEAB_PVC_100MM',
    name: 'Jgheab PVC Ø100mm (semicerc)',
    category: 'Acoperiș', subcategory: 'Sistem pluvial', unit: 'ml', pricePerUnit: 35,
    description: 'Jgheab colectare apă pluvială. Dimensionat conform CR 1-1-4-2012 Art.6.3 — suprafața max captată per jgheab Ø100mm: ~60mp acoperiș. Perimetrul casei = lungimea totală jgheab.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/jgheaburi-burlane/c',
  },
  {
    internalCode: 'BURLAN_PVC_80MM',
    name: 'Burlan PVC Ø80mm',
    category: 'Acoperiș', subcategory: 'Sistem pluvial', unit: 'ml', pricePerUnit: 28,
    description: 'Burlan evacuare apă pluvială. Conform CR 1-1-4-2012 Art.6.3 — 1 burlan Ø80mm la max 50mp suprafață de captare acoperiș. Înălțimea = etaje ale casei + 0.5m până la sol.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/jgheaburi-burlane/c',
  },
  {
    internalCode: 'COAMA_CERAMICA',
    name: 'Coamă ceramică tip T sau rotundă',
    category: 'Acoperiș', subcategory: 'Învelitoare', unit: 'ml', pricePerUnit: 55,
    description: 'Coamă ceramică pentru etanșarea culmii acoperișului. Specifică producătorului de țiglă (Tondach, Creaton). Montare cu mortar de fixare rezistent la îngheț (XF2).',
    isDefault: true,
  },
  {
    internalCode: 'TABLA_TIGLA_METALICA',
    name: 'Tablă tip țiglă metalică (Modern/Roman)',
    category: 'Acoperiș', subcategory: 'Învelitoare', unit: 'mp', pricePerUnit: 55,
    description: 'Învelitoare tablă profilată tip țiglă, oțel zincat 0.5mm. Ușoară (5 kg/mp), rapidă. Alternativă modernă la țigla ceramică. CR 1-1-4-2012 — factor zonă vânt aplicat în calcul.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/tabla-acoperis/c',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── SISTEM ETICS (termoizolație exterioară completă) ──────────────────────────
  // Sursă: ST 011-2014 (ghid aplicare ETICS) + Mc-001-2022 §7 (izolație termică)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'PLASA_FIBRA_STICLA_160G',
    name: 'Plasă fibră sticlă ETICS 160g/mp',
    category: 'Termoizolație', subcategory: 'ETICS', unit: 'mp', pricePerUnit: 12,
    description: 'Plasă armare obligatorie în stratul de bază ETICS, conform ST 011-2014 §5.3. Greutate 160g/mp alcalino-rezistentă. Suprapunere min 10cm la îmbinări. Asigură rezistența mecanică a sistemului.',
    isDefault: true,
  },
  {
    internalCode: 'PRIMER_ETICS_KG',
    name: 'Primer de contact ETICS (grund de contact)',
    category: 'Termoizolație', subcategory: 'ETICS', unit: 'kg', pricePerUnit: 15,
    description: 'Grund de contact aplicat pe stratul de bază (grund armat) înainte de tencuiala decorativă, conform ST 011-2014 §5.5. Consum: 0.2-0.3 kg/mp. Îmbunătățește aderența tencuielii decorative.',
    isDefault: true,
  },
  {
    internalCode: 'TENCUIALA_DECORATIVA_SILOXANICA',
    name: 'Tencuială decorativă siloxanică exterior (sac 25kg)',
    category: 'Termoizolație', subcategory: 'ETICS', unit: 'kg', pricePerUnit: 22,
    description: 'Finisaj exterior sistem ETICS, hidrofob, respirabil (µ<40). Rezistentă la vânt și ploaie. Consum: 2.5-3.5 kg/mp (granulație 1.5-2mm). Mc-001-2022 §7.2 — strat de finisaj exterior obligatoriu pentru protecția termoizolației.',
    isDefault: true,
  },
  {
    internalCode: 'PROFIL_COLT_ARMAT_ML',
    name: 'Profil colț PVC armat cu plasă',
    category: 'Termoizolație', subcategory: 'ETICS', unit: 'ml', pricePerUnit: 8,
    description: 'Profil protecție colț la glafuri, colțuri și muchii — obligatoriu ST 011-2014 §5.4. Integrat în sistemul ETICS pentru protecția mecanică a muchiilor.',
    isDefault: true,
  },
  {
    internalCode: 'XPS_5CM_SOCLU',
    name: 'XPS 5cm (soclu și fundație perimetrală)',
    category: 'Termoizolație', subcategory: 'Soclu', unit: 'mp', pricePerUnit: 40,
    description: 'Polistiren extrudat XPS 5cm pentru termoizolație soclu și fundație perimetrală (zona sub cota ±0). Mc-001-2022 — izolație termică perimetrală recomandată pentru evitarea punților termice la fundație. Rezistență la umiditate și compresiune (200 kPa).',
    isDefault: true,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── FINISAJE BRUTE (glet, vopsea) ─────────────────────────────────────────────
  // Sursă: consumuri declarate producători conform SR EN 13279-1 (glet ipsos)
  //        și SR EN 1062 (vopsele exterioare/interioare)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'GLET_IPSOS_KG',
    name: 'Glet de ipsos Knauf Multifinish (per kg)',
    category: 'Finisaje Brute', subcategory: 'Glet', unit: 'kg', pricePerUnit: 1.80,
    description: 'Glet de ipsos interior pentru netezire pereți și tavan. SR EN 13279-1 clasa C5. Consum: 1.2-1.8 kg/mp/strat (specificație producător Knauf). 2 straturi standard = 1.5 kg/mp medie. Prețul per kg = sac 25kg (45 RON) / 25.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/glet-ipsos/c',
  },
  {
    internalCode: 'GLET_FINISAJ_DANOGIPS',
    name: 'Glet finisaj alb DANOGIPS (sac 25kg)',
    category: 'Finisaje Brute', subcategory: 'Glet', unit: 'sac', pricePerUnit: 48,
    description: 'Glet de finisaj super-alb, acoperire perfectă, SR EN 13279-1. Consum: 0.8-1.0 kg/mp/strat. Alternativă premium față de ipsos pentru suprafețe de calitate superioară.',
    isDefault: false,
  },
  {
    internalCode: 'VOPSEA_LAVABILA_INTERIOR_L',
    name: 'Vopsea lavabilă interior Kober Spor (per L)',
    category: 'Finisaje Brute', subcategory: 'Vopsea', unit: 'L', pricePerUnit: 8,
    description: 'Vopsea lavabilă acrilică interior, clasa A de lavabilitate (SR EN 13300). Consum: 0.11-0.13 L/mp/strat (specificație producător). 2 straturi + grund = 0.34 L/mp total. Preț/L calculat din bidon 15L (120 RON).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/vopsea-lavabila/c',
  },
  {
    internalCode: 'GRUND_IZOLATOR_INTERIOR',
    name: 'Grund izolator interior (per L)',
    category: 'Finisaje Brute', subcategory: 'Vopsea', unit: 'L', pricePerUnit: 6,
    description: 'Grund de penetrare și izolare, aplicat înainte de vopsea lavabilă. Consum: 0.10 L/mp (specificație producători Kober, Deutek). SR EN 1062-1 — strat preparator obligatoriu pe tencuială nouă.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/grund-vopsea/c',
  },
  {
    internalCode: 'VOPSEA_LAVABILA_EXTERIOR_L',
    name: 'Vopsea lavabilă exterior siloxanică (per L)',
    category: 'Finisaje Brute', subcategory: 'Vopsea', unit: 'L', pricePerUnit: 18,
    description: 'Vopsea exterioară siloxanică, rezistentă UV și intemperii. SR EN 1062-1 clasa W3 (impermeabilă la apă). Consum: 0.15 L/mp/strat × 2 straturi = 0.30 L/mp. Alternativă la tencuiala decorativă pentru fațade simple.',
    isDefault: false,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── TÂMPLĂRIE COMPLETĂ (glafuri, ușă blindată, rulouri) ──────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'USA_METALICA_BLINDATA',
    name: 'Ușă metalică blindată intrare RC3',
    category: 'Tâmplărie', subcategory: 'Uși exterior', unit: 'buc', pricePerUnit: 3500,
    description: 'Ușă de intrare blindată, clasa de rezistență RC3 (SR EN 1627). Structură oțel 1.5mm, umplutură antiefracție, geam securizat opțional. Standard premium față de STANDARD_USA_EXTERIOR.',
    isDefault: false,
  },
  {
    internalCode: 'GLAF_PVC_EXTERIOR',
    name: 'Glaf PVC exterior (ml)',
    category: 'Tâmplărie', subcategory: 'Accesorii', unit: 'ml', pricePerUnit: 45,
    description: 'Glaf PVC cu picurător pentru etanșarea exterioară a ferestrei. Obligatoriu la montarea tâmplăriei pentru evitarea infiltrațiilor (SR EN 14351-1). Lățime adaptabilă 20-40cm.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/glafuri/c',
  },
  {
    internalCode: 'GLAF_PVC_INTERIOR',
    name: 'Glaf PVC interior (ml)',
    category: 'Tâmplărie', subcategory: 'Accesorii', unit: 'ml', pricePerUnit: 30,
    description: 'Glaf PVC interior pentru etanșarea și finisarea pervazului interior al ferestrei. Standard în devizele de tâmplărie.',
    isDefault: true,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── FINISAJE FINE (faianță, adezivi, rosturi, parchet accesorii) ──────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'FAIANTA_30X60',
    name: 'Faianță ceramică 30×60cm (baie/bucătărie)',
    category: 'Finisaje Fine', subcategory: 'Placaje', unit: 'mp', pricePerUnit: 55,
    description: 'Faianță ceramică pentru pereți baie și bucătărie. Glazurată, impermeabilă, clasa de absorbție BIb (SR EN 14411). Standard rezidențial.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/faianta/c',
  },
  {
    internalCode: 'ADEZIV_FLEXIBIL_GRESIE_SAC',
    name: 'Adeziv flexibil C2T gresie/faianță (sac 25kg)',
    category: 'Finisaje Fine', subcategory: 'Adezivi', unit: 'sac', pricePerUnit: 35,
    description: 'Adeziv ciment flexibil clasa C2T (SR EN 12004) pentru gresie și faianță. Consum: 3.5-4.5 kg/mp (strat 6mm). Obligatoriu clasa C2 pentru suprafețe cu deformații (planșee, încălzire în pardoseală).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/adeziv-gresie/c',
  },
  {
    internalCode: 'ROST_GRESIE_KG',
    name: 'Rost ciment gresie/faianță (kg)',
    category: 'Finisaje Fine', subcategory: 'Adezivi', unit: 'kg', pricePerUnit: 15,
    description: 'Material de rost (fugă) SR EN 13888. Consum: 0.35-0.50 kg/mp pentru rost 3mm. Hidrofug, rezistent la mucegai. Obligatoriu finalizarea lucrărilor de plăci ceramice.',
    isDefault: true,
  },
  {
    internalCode: 'FOLIE_SEPARATOARE_PARCHET',
    name: 'Folie separatoare sub parchet (mp)',
    category: 'Finisaje Fine', subcategory: 'Pardoseli calde', unit: 'mp', pricePerUnit: 3.5,
    description: 'Folie PE + spumă 2mm sub parchet laminat, obligatorie conform specificațiilor producătorilor de parchet. Rol: barieră umiditate, atenuare zgomot de impact (SR EN ISO 717-2).',
    isDefault: true,
  },
  {
    internalCode: 'PROFIL_TRECERE_PARCHET',
    name: 'Profil de trecere parchet-gresie (ml)',
    category: 'Finisaje Fine', subcategory: 'Pardoseli calde', unit: 'ml', pricePerUnit: 25,
    description: 'Profil metalic/PVC la trecerea dintre pardoseala caldă (parchet) și pardoseala rece (gresie). Finisaj profesional obligatoriu la praguri și treceri.',
    isDefault: true,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── INSTALAȚII SANITARE (I 9-2022) ────────────────────────────────────────────
  // Sursă normativă: Normativ I 9-2022 (instalații sanitare clădiri)
  //                  SR EN 12056-2 (sisteme de canalizare gravitațională)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'TEAVA_PPR_20MM',
    name: 'Țeavă PPR 20mm PN20 (ml)',
    category: 'Instalații Sanitare', subcategory: 'Alimentare apă', unit: 'ml', pricePerUnit: 6,
    description: 'Țeavă polipropilenă reticulată PN20 Ø20mm, pentru distribuție apă rece și caldă. I 9-2022 §8.3 — conducte de legătură de la distribuitor la obiectul sanitar, max 8m fără recirculare. SR EN ISO 15874.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tevi-ppr/c',
  },
  {
    internalCode: 'TEAVA_PPR_25MM',
    name: 'Țeavă PPR 25mm PN20 (ml)',
    category: 'Instalații Sanitare', subcategory: 'Alimentare apă', unit: 'ml', pricePerUnit: 9,
    description: 'Țeavă PPR PN20 Ø25mm, coloană principală distribuție apă. I 9-2022 §8.2 — coloane de alimentare dimensionate la debitul simultan maxim (SR EN 806-3).',
    isDefault: true,
  },
  {
    internalCode: 'TEAVA_PEX_16MM',
    name: 'Țeavă PEX 16mm (ml) — distribuție',
    category: 'Instalații Sanitare', subcategory: 'Alimentare apă', unit: 'ml', pricePerUnit: 7,
    description: 'Țeavă polietilenă reticulată Ø16mm, alternativă flexibilă la PPR pentru trasee în pardoseală. SR EN ISO 15875. I 9-2022 — admisă pentru instalații interioare.',
    isDefault: false,
  },
  {
    internalCode: 'TEAVA_PVC_D110',
    name: 'Țeavă PVC canalizare Ø110mm (ml)',
    category: 'Instalații Sanitare', subcategory: 'Canalizare', unit: 'ml', pricePerUnit: 25,
    description: 'Coloană principală canalizare menajeră. I 9-2022 §13.3 + SR EN 12056-2 sistem II — Ø110mm obligatoriu pentru coloane verticale care primesc WC. Panta min 2% pe orizontală.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tevi-canalizare/c',
  },
  {
    internalCode: 'TEAVA_PVC_D50',
    name: 'Țeavă PVC canalizare Ø50mm (ml)',
    category: 'Instalații Sanitare', subcategory: 'Canalizare', unit: 'ml', pricePerUnit: 15,
    description: 'Conductă de legătură obiecte sanitare (lavoar, duș, chiuvetă). I 9-2022 §13 + SR EN 12056-2 — Ø50mm pentru lavoar și duș, max debit specific 0.5 l/s. Panta 2-3%.',
    isDefault: true,
  },
  {
    internalCode: 'SIFON_PARDOSEALA',
    name: 'Sifon pardoseală inox Ø50mm',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 65,
    description: 'Sifon de pardoseală cu gardă hidraulică min 50mm, conform I 9-2022 §5.5 — obligatoriu în băi, bucătării și centrale termice pentru colectarea apelor accidentale.',
    isDefault: true,
  },
  {
    internalCode: 'VAS_WC_SUSPENDAT',
    name: 'Vas WC suspendat ceramic',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 850,
    description: 'Vas WC suspendat, ceramic glazurat, cu sistem de spălare 6/3L (conform Directivei Europene 92/42/CEE). I 9-2022 Tab.1 — dotat obligatoriu în apartamente (1 WC/locință).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/vas-wc/c',
  },
  {
    internalCode: 'CADRU_WC_SUSPENDAT',
    name: 'Cadru încastrat WC suspendat (Geberit UP200)',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 650,
    description: 'Cadru de montaj îngropat pentru WC suspendat, cu rezervor încastrat 6/3L (SR EN 12541). I 9-2022 — rezervoarele cu spălare eficientă obligatorii în clădiri noi conform Legea 372/2005.',
    isDefault: true,
  },
  {
    internalCode: 'LAVOAR_CERAMIC',
    name: 'Lavoar ceramic 60cm (cu sau fără piedestal)',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 250,
    description: 'Lavoar ceramic 60cm SR EN 14688. I 9-2022 Tab.1 — obligatoriu în baie + bucătărie. Consum apă: debit specific qs=0.2 l/s (SR EN 806-3 Tab.1).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/lavoare/c',
  },
  {
    internalCode: 'BATERIE_LAVOAR',
    name: 'Baterie monocomandă lavoar (cu economizor)',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 280,
    description: 'Baterie monocomandă cu limitator de debit 6L/min (Directiva 92/42/CEE). I 9-2022 §6 — robinete cu economizor de apă recomandate în clădiri noi.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/baterii-lavoar/c',
  },
  {
    internalCode: 'CADA_BAIE_ACRILICA',
    name: 'Cadă baie acrilică 170×70cm',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 650,
    description: 'Cadă acrilică 170×70cm, SR EN 198. I 9-2022 Tab.1 — opțiune în loc de cabina duș. Consum apă: qs=0.3 l/s (SR EN 806-3). Permite și instalarea unui sistem de duș deasupra.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/cazi-baie/c',
  },
  {
    internalCode: 'CABINA_DUS',
    name: 'Cabină duș 80×80cm cu panou fix',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 750,
    description: 'Cabină duș 80×80cm cu geam securizat 6mm (SR EN 12150). Alternativă la cada de baie, preferată în băi mici. I 9-2022 — qs=0.2 l/s pentru duș.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/cabine-dus/c',
  },
  {
    internalCode: 'BATERIE_CADA_DUS',
    name: 'Baterie termostatată cadă/duș',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 350,
    description: 'Baterie termostatată cu limitare temperatură la 38°C (obligatoriu conform I 9-2022 §11.13 — protecție opărire). Debit max 12L/min.',
    isDefault: true,
  },
  {
    internalCode: 'CHIUVETA_INOX',
    name: 'Chiuvetă inox bucătărie 1.5 cuve',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 350,
    description: 'Chiuvetă inox 1.5 cuve SR EN 13310. I 9-2022 Tab.1 — obligatorie în bucătărie. qs=0.2 l/s (SR EN 806-3).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/chiuvete/c',
  },
  {
    internalCode: 'BATERIE_BUCATARIE',
    name: 'Baterie bucătărie cu cap extensibil',
    category: 'Instalații Sanitare', subcategory: 'Obiecte sanitare', unit: 'buc', pricePerUnit: 280,
    description: 'Baterie bucătărie monocomandă cu cap rabatabil. I 9-2022 §6 — racordare la apă rece și caldă, rezistentă la presiuni de 0.1-0.5 MPa (rețeaua de distribuție).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/baterii-bucatarie/c',
  },
  {
    internalCode: 'CENTRALA_TERMICA_GAZ',
    name: 'Centrală termică condensare gaz 24kW',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 5500,
    description: 'Centrală în condensare ≥24kW (Vaillant ecoTEC, Viessmann Vitodens sau echivalent). Eficiență ≥109% (Directiva 92/42/CEE, clasa 4). I 9-2022 §11 — sistem de preparare ACM și încălzire centralizat. Recomandat conform Legii 372/2005 (performanță energetică).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/centrale-termice/c',
  },
  {
    internalCode: 'BOILER_ELECTRIC_80L',
    name: 'Boiler electric 80L',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 800,
    description: 'Boiler electric 80L, 2kW. Alternativă locală la centrala termică pentru preparare ACM. I 9-2022 Tab.1 — capacitate recomandata 50-80L/persoana × 2-3 persoane. Protecție anti-legionella la 60°C.',
    isDefault: false, storeUrl: 'https://www.dedeman.ro/ro/boilere/c',
  },
  {
    internalCode: 'RADIATOR_PANEL_600X900',
    name: 'Radiator panel oțel 600×900mm (tip 22)',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 450,
    description: 'Radiator panou oțel tip 22 (dublu panou + dublu convector), 600×900mm, putere ~1800W la 75/65°C. SR EN 442-1. I 9-2022 §14 — dimensionat la necesarul termic al încăperii (W/mp funcție de zona climatică).',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/radiatoare/c',
  },
  {
    internalCode: 'ROBINET_TERMOSTATIC',
    name: 'Robinet termostatic radiator (cap termostatic)',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 85,
    description: 'Robinet termostatic cu cap termostatic reglabil 6-28°C. I 9-2022 §14.8 — obligatoriu la fiecare radiator conform Directivei 2012/27/UE (eficiență energetică clădiri). Economie 15-30% energie termică.',
    isDefault: true,
  },
  {
    internalCode: 'VAS_EXPANSIUNE_25L',
    name: 'Vas de expansiune 25L',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 180,
    description: 'Vas de expansiune cu membrană 25L pentru instalație de încălzire. I 9-2022 §14.4 — obligatoriu în instalații închise pentru preluarea dilatărilor termice. Presiune preîncărcare 1.5 bar.',
    isDefault: true,
  },
  {
    internalCode: 'POMPA_CIRCULATIE',
    name: 'Pompă de circulație instalație termică',
    category: 'Instalații Sanitare', subcategory: 'Instalații termice', unit: 'buc', pricePerUnit: 350,
    description: 'Pompă circulație cu turație variabilă (clasă energetică A — Regulamentul UE 641/2009). I 9-2022 §14.6 — obligatorie în sistemele de încălzire cu apă caldă pentru circulația agentului termic.',
    isDefault: true,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── INSTALAȚII ELECTRICE (I 7-2011) ───────────────────────────────────────────
  // Sursă normativă: Normativ I 7-2011 (instalații electrice clădiri)
  //                  SR EN 60364 (instalații electrice de joasă tensiune)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    internalCode: 'TABLOU_ELECTRIC_24M',
    name: 'Tablou electric 24 module IP40',
    category: 'Instalații Electrice', subcategory: 'Tablouri', unit: 'buc', pricePerUnit: 280,
    description: 'Tablou electric de distribuție 24 module, IP40, SR EN 61439-3. I 7-2011 §4 — tabloul principal al locuinței conține siguranțele automate, diferențialele și bara de nul+PE. Dimensionat la min 12 circuite pentru o casă P+1.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tablouri-electrice/c',
  },
  {
    internalCode: 'SIGURANTA_AUTOMATA_16A',
    name: 'Siguranță automată 16A/1P curba B',
    category: 'Instalații Electrice', subcategory: 'Protecție', unit: 'buc', pricePerUnit: 25,
    description: 'Întreruptor automat 16A monofazic curba B, SR EN 60898-1. I 7-2011 §5.3 — protecție circuit prize (max 8 prize/circuit la 16A) și aparate casnice. Curent de defect min 2500A.',
    isDefault: true,
  },
  {
    internalCode: 'SIGURANTA_AUTOMATA_20A',
    name: 'Siguranță automată 20A/1P curba B',
    category: 'Instalații Electrice', subcategory: 'Protecție', unit: 'buc', pricePerUnit: 28,
    description: 'Întreruptor automat 20A curba B, SR EN 60898-1. I 7-2011 §5.3 — protecție circuit aparate mari (mașina de spălat, uscător, boiler). Circuite dedicate separate.',
    isDefault: false,
  },
  {
    internalCode: 'SIGURANTA_DIFERENTIALA_30MA',
    name: 'Siguranță diferențială 30mA/2P 40A',
    category: 'Instalații Electrice', subcategory: 'Protecție', unit: 'buc', pricePerUnit: 120,
    description: 'Întreruptor diferențial 30mA sensibilitate tip A, SR EN 61008-1. I 7-2011 §4.1 (Tab.4.1) — protecție obligatorie împotriva curenților de defect, obligatoriu pentru toate circuitele de prize și baie. Timp deconectare <30ms.',
    isDefault: true,
  },
  {
    internalCode: 'CABLU_CYY_F_3X2_5',
    name: 'Cablu CYY-F 3×2.5mm² (ml)',
    category: 'Instalații Electrice', subcategory: 'Cabluri', unit: 'ml', pricePerUnit: 8.5,
    description: 'Cablu cupru flexibil izolat PVC, 3 conductoare (faza+nul+PE) 2.5mm², SR CEI 60227. I 7-2011 §5 — standard pentru circuite prize (capacitate 16A/2500W). Montat în tub PVC sub tencuială.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/cabluri-electrice/c',
  },
  {
    internalCode: 'CABLU_CYY_F_3X1_5',
    name: 'Cablu CYY-F 3×1.5mm² (ml)',
    category: 'Instalații Electrice', subcategory: 'Cabluri', unit: 'ml', pricePerUnit: 5.5,
    description: 'Cablu cupru flexibil 3×1.5mm², SR CEI 60227. I 7-2011 §5 — standard pentru circuite de iluminat (capacitate 10A/2300W). Mai subțire decât cablul de prize, permite mai multe conductoare per tub.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/cabluri-electrice/c',
  },
  {
    internalCode: 'TUB_PVC_D20_ML',
    name: 'Tub protecție PVC Ø20mm (ml)',
    category: 'Instalații Electrice', subcategory: 'Cabluri', unit: 'ml', pricePerUnit: 3,
    description: 'Tub protecție PVC gofrat Ø20mm (exterior), SR EN 61386-1. I 7-2011 Tab.4.1 — protecție obligatorie pentru conductoare montate sub tencuială. Ø20mm acceptă max 2 cabluri 3×2.5mm².',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/tuburi-electrice/c',
  },
  {
    internalCode: 'TUB_PVC_D16_ML',
    name: 'Tub protecție PVC Ø16mm (ml)',
    category: 'Instalații Electrice', subcategory: 'Cabluri', unit: 'ml', pricePerUnit: 2.5,
    description: 'Tub protecție PVC gofrat Ø16mm. I 7-2011 — utilizat pentru circuitele de iluminat (cablu 1.5mm² mai subțire). Montat înainte de tencuire.',
    isDefault: true,
  },
  {
    internalCode: 'PRIZA_DUBLA_16A',
    name: 'Priză dublă 16A cu împământare (buc)',
    category: 'Instalații Electrice', subcategory: 'Aparataj', unit: 'buc', pricePerUnit: 25,
    description: 'Priză dublă 16A/250V cu contact de protecție (împământare), tip Schuko, SR EN 60884-2-1. I 7-2011 Anexă — dotare minimă pe cameră: living 3 prize, dormitor 2 prize, bucătărie 4 prize (cu circuit dedicat). Montat în doze de instalare.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/prize-intrerupatoare/c',
  },
  {
    internalCode: 'INTRERUPATOR_SIMPLU',
    name: 'Întrerupător simplu 10A (buc)',
    category: 'Instalații Electrice', subcategory: 'Aparataj', unit: 'buc', pricePerUnit: 18,
    description: 'Întrerupător simplu 10A/250V, SR EN 60669-1. I 7-2011 — 1 întrerupător per circuit lumina/cameră. Standard rezidențial. Același serie cu prizele pentru estetică uniformă.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/prize-intrerupatoare/c',
  },
  {
    internalCode: 'COMUTATOR_CAP_SCARA',
    name: 'Comutator cap-scară 10A (buc)',
    category: 'Instalații Electrice', subcategory: 'Aparataj', unit: 'buc', pricePerUnit: 22,
    description: 'Comutator pentru comandă lumina din 2 locuri (cap-scară), SR EN 60669-1. I 7-2011 — obligatoriu la scări, holuri lungi și camere cu 2 intrări. 2 comutatoare per circuit comandat din 2 locuri.',
    isDefault: false,
  },
  {
    internalCode: 'CUTIE_DERIVATIE',
    name: 'Cutie derivație IP44 (buc)',
    category: 'Instalații Electrice', subcategory: 'Aparataj', unit: 'buc', pricePerUnit: 12,
    description: 'Cutie de derivație cu capac, IP44, SR EN 60670. I 7-2011 §3 — obligatorie la orice ramificație a circuitelor electrice. Permite accesul ulterior la derivații conform normei. 1 cutie la fiecare ramificație de circuit.',
    isDefault: true,
  },
  {
    internalCode: 'SPOT_LED_INCASTRAT',
    name: 'Spot LED incastrat 7W GU10 (buc)',
    category: 'Instalații Electrice', subcategory: 'Corpuri de iluminat', unit: 'buc', pricePerUnit: 35,
    description: 'Corp de iluminat incastrat LED 7W/630lm, clasa A++ (Reg. UE 874/2012). I 7-2011 §6 — iluminatul locuinței dimensionat la min 200 lux cameră (SR EN 12464-1). ~4-6 spoturi/cameră 12mp.',
    isDefault: true, storeUrl: 'https://www.dedeman.ro/ro/spoturi-led/c',
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('[seedBaselineMaterials] Start — upsert materiale extins...');
  console.log('='.repeat(60));

  let created = 0;
  let updated = 0;

  for (const mat of BASELINE_MATERIALS) {
    const existing = await prisma.material.findUnique({
      where: { internalCode: mat.internalCode },
      select: { id: true, pricePerUnit: true },
    });

    if (existing) {
      await prisma.material.update({
        where: { internalCode: mat.internalCode },
        data: {
          name:        mat.name,
          description: mat.description,
          storeUrl:    mat.storeUrl || null,
        },
      });
      console.log(`  [UPDATE] ${mat.internalCode}`);
      updated++;
    } else {
      await prisma.material.create({
        data: {
          internalCode: mat.internalCode,
          name:         mat.name,
          category:     mat.category,
          subcategory:  mat.subcategory,
          unit:         mat.unit,
          pricePerUnit: mat.pricePerUnit,
          description:  mat.description,
          isDefault:    mat.isDefault,
          brand:        null,
          storeUrl:     mat.storeUrl || null,
          uValue:       null,
        },
      });
      console.log(`  [CREATE] ${mat.internalCode}`);
      created++;
    }
  }

  console.log('='.repeat(60));
  console.log(`[seedBaselineMaterials] Finalizat DB upsert: ${created} create, ${updated} update.`);
  
  // Rulăm sincronizarea cu web scraper-ul automat
  console.log(`\n[seedBaselineMaterials] Rulare Web Scraper & Vectorizare...`);
  try {
    const syncRes = await scraperService.syncAllMaterials(true);
    console.log(`[seedBaselineMaterials] Scraper OK: ${syncRes.updated} materiale actualizate, ${syncRes.failed} erori.`);
  } catch(e) {
    console.error(`[seedBaselineMaterials] Eroare la scraper sync:`, e);
  }

  console.log('\n[VALIDARE INTEGRITATE BOM]:');
  const fs = await import('fs');
  const path = await import('path');
  const formulasPath = path.join(__dirname, '../data/bom-formulas.json');
  const formulas = JSON.parse(fs.readFileSync(formulasPath, 'utf8'));

  const requiredCodes = new Set<string>();
  for (const [key, val] of Object.entries<any>(formulas)) {
    if (key === '_meta') continue;
    if (val.defaultMaterialCode) requiredCodes.add(val.defaultMaterialCode);
  }

  let missingCount = 0;
  for (const code of requiredCodes) {
    const mat = await prisma.material.findUnique({ where: { internalCode: code } });
    if (!mat) {
      console.error(`  ❌ LIPSĂ în DB: ${code}`);
      missingCount++;
    } else {
      console.log(`  ✅ OK: ${code}`);
    }
  }

  if (missingCount > 0) {
    console.error(`\n❌ ${missingCount} materiale lipsă în catalog!`);
    process.exit(1);
  } else {
    console.log('\n✅ Toate materialele BOM sunt prezente în catalog.');
  }
}

main()
  .catch((e) => {
    console.error('[seedBaselineMaterials] Eroare fatală:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
