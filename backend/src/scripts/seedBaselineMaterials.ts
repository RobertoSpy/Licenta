// backend/src/scripts/seedBaselineMaterials.ts
//
// Seed DETERMINISTIC — materiale standard necesare motorului BOM.
// Acestea NU vin din scraping, ci sunt definite normativ:
//   • Codurile trebuie să fie EXACT cele folosite în bom-formulas.json (defaultMaterialCode)
//   • Prețurile sunt estimative (medii naționale 2024) — vor fi suprascrise de scraperService
//
// Rulare: npx ts-node -e "require('./src/scripts/seedBaselineMaterials')"
// sau via docker: docker exec <container> npx ts-node src/scripts/seedBaselineMaterials.ts

import { PrismaClient } from '@prisma/client';

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
}

// ─────────────────────────────────────────────────────────────────
// CATALOG MATERIALE STANDARD
// Actualizează prețurile periodic sau prin scraperService.
// ─────────────────────────────────────────────────────────────────

const BASELINE_MATERIALS: BaselineMaterial[] = [
  // ── BETON ────────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_BETON_C20_25',
    name: 'Beton C20/25-XC2 (fundații — sol normal, îngheț ≤90cm)',
    category: 'Beton',
    subcategory: 'Fundații',
    unit: 'mc',
    pricePerUnit: 420, // RON/mc inclusiv transport, 2024
    description: [
      'Clasa de rezistență: C20/25 (fck=20 MPa)',
      'Clasa de expunere: XC2 (beton îngropat în sol umed, conf. NE012-1:2022 Tab.E.1)',
      'Aplicare: fundații continue în zone cu adâncime îngheț ≤90cm și ag<0.30g',
      'Normativ: NE012-1:2022 + EN 206-1',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_BETON_C25_30',
    name: 'Beton C25/30-XF2 (fundații — zone seismice ag≥0.30g sau îngheț >90cm)',
    category: 'Beton',
    subcategory: 'Fundații',
    unit: 'mc',
    pricePerUnit: 465, // RON/mc, ~10% mai scump față de C20/25
    description: [
      'Clasa de rezistență: C25/30 (fck=25 MPa)',
      'Clasa de expunere: XF2 (cicli îngheț-dezgheț moderați cu degivrare, conf. NE012-1:2022 Tab.E.1)',
      'Aplicare OBLIGATORIE dacă: ag≥0.30g (zone DCH — Vrancea, Ilfov, București) SAU adâncime îngheț>90cm',
      'Normativ: NE012-1:2022 Tab.E.1 + P100-1/2013 Cap.8 cerințe ductilitate DCH',
      '⚠️ Selectat automat de contextMultiplierEngine când condițiile sunt îndeplinite.',
    ].join('\n'),
    isDefault: true,
  },

  // ── ARMĂTURĂ ─────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_FIER_12',
    name: 'Armătură oțel-beton Ø12mm PC52/B500C',
    category: 'Armătură',
    subcategory: 'Bare longitudinale',
    unit: 'kg',
    pricePerUnit: 4.20, // RON/kg, 2024
    description: [
      'Diametru: Ø12mm | Greutate: 0.888 kg/ml (STAS 438-1)',
      'Clasă oțel: B500C (PC52) — sudabilă, ductilitate înaltă',
      'Aplicare: bare longitudinale fundații, armătură centuri, armătură planșee',
      'Normativ: SR EN 10080, STAS 438-1',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_FIER_14',
    name: 'Armătură oțel-beton Ø14mm PC52/B500C',
    category: 'Armătură',
    subcategory: 'Bare longitudinale',
    unit: 'kg',
    pricePerUnit: 4.15, // RON/kg, 2024 (ușor mai ieftin la kg față de Ø12)
    description: [
      'Diametru: Ø14mm | Greutate: 1.208 kg/ml (STAS 438-1)',
      'Clasă oțel: B500C (PC52) — sudabilă, ductilitate înaltă',
      'Aplicare: bare principale stâlpișori de zidărie confinată (ZC)',
      'Conform CR6-2013 Art.7.4.4: 4 bare Ø14mm per stâlpișor (minim)',
      'Normativ: SR EN 10080, STAS 438-1 + CR6-2013',
    ].join('\n'),
    isDefault: true,
  },

  // ── COFRAJ ───────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_PLACAJ_COFRARE',
    name: 'Placaj cofraj 18mm (cofraje fundații)',
    category: 'Cofraj',
    subcategory: null,
    unit: 'mp',
    pricePerUnit: 38, // RON/mp (placaj de 1 utilizare)
    description: [
      'Placaj fenolic 18mm pentru cofrarea fețelor laterale ale fundațiilor',
      'Utilizat la fundații continue; 15% pierderi la decofrare (wastePercent)',
      'Normativ: NE012-1:2022 Cap.6 cerințe cofraje',
    ].join('\n'),
    isDefault: true,
  },

  // ── ZIDĂRIE ──────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_BCA_25',
    name: 'Blocuri BCA 25cm (Ytong/Macon/Celco) — pereți exteriori',
    category: 'Zidărie',
    subcategory: 'Pereți exteriori',
    unit: 'mp',
    pricePerUnit: 65, // RON/mp pus în operă (material + manoperă simplificată)
    description: [
      'BCA B3.5/C2.5, grosime 25cm, λ=0.14 W/mK',
      'Aplicare: pereți exteriori structurali sau de umplutură la structuri în cadre',
      'Normativ: SR EN 771-4, CR6-2013 Art.5.2 grosime minimă pereți structurali',
      '✅ Avantaj: izolație termică excelentă, ușor de prelucrat',
      '⚠️ Dezavantaj: rezistență la umiditate redusă — necesită finisaje exterioare impermeabile',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_BCA_12',
    name: 'Blocuri BCA 12.5cm — pereți interiori despărțitori',
    category: 'Zidărie',
    subcategory: 'Pereți interiori',
    unit: 'mp',
    pricePerUnit: 38, // RON/mp
    description: [
      'BCA B3.5/C2.5, grosime 12.5cm, λ=0.14 W/mK',
      'Aplicare: pereți despărțitori nestructurali interiori',
      'Normativ: SR EN 771-4, NP057-2002 (grosimi minime pereți despărțitori)',
    ].join('\n'),
    isDefault: true,
  },

  // ── ACOPERIȘ ─────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_TIGLA_CERAMICA',
    name: 'Țiglă ceramică (Tondach/Bramac/Creaton) — învelitoare șarpantă',
    category: 'Acoperiș',
    subcategory: 'Învelitoare',
    unit: 'mp',
    pricePerUnit: 75, // RON/mp
    description: [
      'Țiglă ceramică profilată, greutate ~40-45 kg/mp, durată viață >50 ani',
      'Aplicare: învelitoare șarpantă pantă 30-45°',
      'Normativ: CR1-1-4-2012 Art.6 (verificare la suțiune vânt)',
      '✅ Avantaj: durabilitate ridicată, estetică tradițională',
      '⚠️ Dezavantaj: greutate mare → necesită șarpantă mai robustă',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_LEMN_STRUCTURA',
    name: 'Cherestea rășinoase clasa C24 (căpriori, pane, coamă)',
    category: 'Acoperiș',
    subcategory: 'Structură lemn',
    unit: 'mc',
    pricePerUnit: 1450, // RON/mc cherestea tratată, 2024
    description: [
      'Cherestea rășinoase (brad/pin) cls. C24 conform SR EN 338, tratată ignifug+antifungic',
      'Aplicare: căpriori (8×12cm), pane (12×16cm), coamă, dulapi astereală',
      'Normativ: NP005-2003 Cod de proiectare pentru structuri din lemn, CR1-1-4-2012',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_VATA_BAZALTICA',
    name: 'Vată bazaltică 15cm (izolație termică pod nelocuibil)',
    category: 'Izolație termică',
    subcategory: 'Acoperiș',
    unit: 'mp',
    pricePerUnit: 55, // RON/mp (material + montaj)
    description: [
      'Vată bazaltică rigidă/semi-rigidă 15cm, λ=0.035-0.040 W/mK',
      'Aplicare: termoizolație pardoseală pod (cea mai eficientă metodă cost-eficiență)',
      'Normativ: MC001-2022 (performanță energetică), Legea372-2005 (NZEB)',
      '✅ Avantaj: incombustibil (A1 Euroclass), rezistent la umiditate, fonoabsorbant',
    ].join('\n'),
    isDefault: true,
  },

  // ── FINISAJE ─────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_SAPA',
    name: 'Șapă ciment-nisip (5cm) — pardoseală',
    category: 'Finisaje brute',
    subcategory: 'Pardoseală',
    unit: 'mp',
    pricePerUnit: 28, // RON/mp
    description: [
      'Șapă de nivelare ciment M50, grosime 5cm',
      'Aplicare: pe toată suprafața de pardoseală, suport pentru finisaje (gresie, parchet, PVC)',
      'Consum: ~90kg material uscat/mp la 5cm grosime',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_TENCUIALA',
    name: 'Tencuială interioară pe bază de ipsos (Knauf/Saint-Gobain)',
    category: 'Finisaje brute',
    subcategory: 'Pereți',
    unit: 'mp',
    pricePerUnit: 22, // RON/mp (material, fără manoperă)
    description: [
      'Tencuială la mașină pe bază de ipsos, grosime 1.2cm',
      'Aplicare: suprafețe interioare pereți și tavan (manual sau mașinizat)',
      'Consum: ~9.5 kg/mp la 1.2cm grosime',
    ].join('\n'),
    isDefault: true,
  },

  // ── TÂMPLĂRIE ────────────────────────────────────────────────────
  {
    internalCode: 'STANDARD_USA_EXTERIOR',
    name: 'Ușă de intrare termopan — steel/PVC (90×210cm)',
    category: 'Tâmplărie',
    subcategory: 'Uși exterioare',
    unit: 'buc',
    pricePerUnit: 1800, // RON/buc montată
    description: [
      'Ușă de intrare cu tocul inclus, 90×210cm, cu geam termopan lateral',
      'Izolație termică: Uf≤1.4 W/m²K (conf. MC001-2022 cerință minimă)',
      'Clasa de efracție RC2 (conf. SR EN 1627)',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_USA_INTERIOR',
    name: 'Ușă interioară finisaj lemn/HDF (80×200cm)',
    category: 'Tâmplărie',
    subcategory: 'Uși interioare',
    unit: 'buc',
    pricePerUnit: 550, // RON/buc montată
    description: [
      'Ușă interioară 80×200cm cu toc și pervaz, finisaj HDF/furnir',
      'Aplicare: camere de zi, dormitoare, bucătărie (excepție: baie — necesită izolație acustică suplimentară)',
    ].join('\n'),
    isDefault: true,
  },
  {
    internalCode: 'STANDARD_FEREASTRA_PVC',
    name: 'Fereastră PVC 5 camere, geam 2K (120×120cm)',
    category: 'Tâmplărie',
    subcategory: 'Ferestre',
    unit: 'buc',
    pricePerUnit: 850, // RON/buc montată
    description: [
      'Fereastră PVC albă 5 camere, cu geam termoizolant 2K low-e (4-16-4)',
      'Uf=1.0 W/m²K, Ug=1.1 W/m²K (conf. MC001-2022 cerință minimă clădiri noi)',
      'Aplicare: ferestre standard locuințe; AI poate sugera 3K (tripan) pentru zone cu ger sever',
    ].join('\n'),
    isDefault: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// MAIN — upsert toate materialele de bază
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('[seedBaselineMaterials] Start — upsert materiale standard BOM...');
  console.log('='.repeat(60));

  let created = 0;
  let updated = 0;

  for (const mat of BASELINE_MATERIALS) {
    const existing = await prisma.material.findUnique({
      where: { internalCode: mat.internalCode },
      select: { id: true, pricePerUnit: true },
    });

    if (existing) {
      // Actualizăm doar descrierea și prețul — nu suprascriem prețul din scraper dacă e mai recent
      await prisma.material.update({
        where: { internalCode: mat.internalCode },
        data: {
          name:        mat.name,
          description: mat.description,
          // Nu actualizăm prețul dacă e deja în DB — scraperService are prioritate
        },
      });
      console.log(`  [UPDATE] ${mat.internalCode} — prețul existent: ${existing.pricePerUnit} RON/${mat.unit} (nemodificat)`);
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
          storeUrl:     null,
          uValue:       null,
        },
      });
      console.log(`  [CREATE] ${mat.internalCode} — ${mat.pricePerUnit} RON/${mat.unit}`);
      created++;
    }
  }

  console.log('='.repeat(60));
  console.log(`[seedBaselineMaterials] Finalizat: ${created} create, ${updated} update.`);

  // Validare integritate — verificăm că toate codurile din bom-formulas.json sunt prezente
  const fs = await import('fs');
  const path = await import('path');
  const formulasPath = path.join(__dirname, '../data/bom-formulas.json');
  const formulas = JSON.parse(fs.readFileSync(formulasPath, 'utf8'));

  const requiredCodes = new Set<string>();
  for (const [key, val] of Object.entries<any>(formulas)) {
    if (key === '_meta') continue;
    if (val.defaultMaterialCode) requiredCodes.add(val.defaultMaterialCode);
  }

  console.log('\n[VALIDARE INTEGRITATE BOM]:');
  let missingCount = 0;
  for (const code of requiredCodes) {
    const mat = await prisma.material.findUnique({ where: { internalCode: code } });
    if (!mat) {
      console.error(`  ❌ LIPSĂ în DB: ${code}`);
      missingCount++;
    } else {
      console.log(`  ✅ OK: ${code} (${mat.pricePerUnit} RON/${mat.unit})`);
    }
  }

  if (missingCount > 0) {
    console.error(`\n❌ ${missingCount} materiale lipsă! BOM-ul va genera cantități fără preț.`);
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
