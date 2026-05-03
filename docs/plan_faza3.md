# Plan Implementare — Faza 3: Etape Construcție, Materiale & Deviz Final

> **Nivel**: Senior Software Developer
> **Arhitectura**: Monolitic Modular — `Routes → Controllers → Services → Repositories → DB (Prisma)`
> **Principiu BOM**: Calculul cantităților de materiale este **100% determinist** (formule din `bom-formulas.json`). AI-ul **nu calculează** — el explică, optimizează și compară alternative. Datele financiare nu se lasă pe seama unui LLM.
> **Principiu Faza 3**: Transformăm planul 2D (output Faza 2) + datele tehnice (output Faza 1) într-un **deviz complet estimat**, cu achiziție sugerată pe etape de construcție, prețuri live și optimizare buget asistată de AI.

---

## STADIU LA INTRAREA ÎN FAZA 3

| Componentă | Status |
|---|---|
| Wizard 4 pași compleți (Faza 1) | ✅ din Faza 1 |
| Date tehnice: seismicZone, frostDepth, maxFloors | ✅ din Faza 1 |
| Plan 2D publicat (PlanSnapshot.isPublished) | ✅ din Faza 2 |
| Suprafețe camere calculate + conformitate | ✅ din Faza 2 |
| Catalog materiale în DB | ❌ TODO |
| BOM Engine (calcul cantități) | ❌ TODO |
| Prețuri materiale live | ❌ TODO |
| Etape construcție (timeline) | ❌ TODO |
| Optimizare buget AI | ❌ TODO |
| Export PDF deviz final | ❌ TODO |
| Estimare clasă energetică | ❌ TODO |

---

## OBIECTIVUL FAZEI 3

La finalul Fazei 3, utilizatorul poate:

1. **Genera automat devizul complet** de materiale și manoperă pe baza planului din Faza 2
2. **Vedea construcția organizată pe 7 etape** (Fundație → Finisaje Fine) cu materialele și costul fiecărei etape
3. **Alege variante de materiale** (ex: BCA Ytong vs. cărămidă tradițională vs. beton celular) cu comparație automată cost + performance + clasă energetică
4. **Optimiza bugetul** cu ajutorul AI-ului: alternative mai ieftine fără compromisuri de siguranță
5. **Vedea prețurile actuale** ale materialelor (actualizate săptămânal din Leroy Merlin, Dedeman)
6. **Exporta PDF-ul final**: plan 2D + deviz pe etape + total estimat cu TVA
7. **Vedea estimarea clasei energetice** în funcție de materialele alese și ce ar trebui schimbat

---

## ARHITECTURA MODULARĂ FAZA 3

```
backend/src/
├── routes/
│   ├── bomRoutes.ts           🆕 NEW — calcul BOM, prețuri, categorii
│   ├── materialRoutes.ts      🆕 NEW — catalog materiale, alternative, comparații
│   ├── constructionRoutes.ts  🆕 NEW — etape construcție, timeline, progres
│   └── exportRoutes.ts        🆕 NEW — PDF deviz final complet
│
├── controllers/
│   ├── bomController.ts       🆕 NEW — calcul deviz + retrieval
│   ├── materialController.ts  🆕 NEW — catalog + filtrare + comparații
│   ├── constructionController.ts 🆕 NEW — etape + progres
│   └── exportController.ts    🆕 NEW — generare PDF Puppeteer
│
├── services/
│   ├── bomService.ts          🆕 NEW — evaluare formule, asamblare BOM
│   ├── priceService.ts        🆕 NEW — prețuri curente + cron scraping
│   ├── energyClassService.ts  🆕 NEW — estimare clasă energetică (MC 001-2022)
│   ├── exportService.ts       🆕 NEW — HTML template + Puppeteer PDF
│   └── ai/
│       ├── agentOrchestrator.ts  ✅ EXTINS — optimizeBudget() + explainMaterial()
│       └── budgetOptimizer.ts    🆕 NEW — RAG pentru alternative materiale
│
├── repositories/
│   ├── bomRepository.ts       🆕 NEW — CRUD ProjectBOM
│   ├── materialRepository.ts  🆕 NEW — CRUD Material + PriceHistory
│   └── constructionRepository.ts 🆕 NEW — CRUD ConstructionPhase
│
├── data/
│   ├── materials-catalog.json 🆕 DATA — catalog complet materiale + prețuri bază
│   ├── bom-formulas.json      🆕 DATA — formule calcul cantitate per element constructiv
│   ├── construction-phases.json 🆕 DATA — etapele standard ale construcției + materiale
│   └── energy-classes.json    🆕 DATA — U-values materiale + praguri clasă A→G
│
└── scripts/
    └── seedMaterials.ts       🆕 NEW — populare catalog materiale în DB

frontend/src/
├── pages/dashboard/
│   ├── ProjectBOM.tsx         🆕 NEW — pagina deviz materiale (per etapă + total)
│   └── ProjectTimeline.tsx    🆕 NEW — pagina etape construcție cu progres
│
├── components/bom/
│   ├── BOMStageCard.tsx       🆕 NEW — card etapă (Fundație, Structură etc.)
│   ├── BOMTable.tsx           🆕 NEW — tabel materiale cu cantitate + preț + link magazin
│   ├── BOMSummary.tsx         🆕 NEW — sumar cost total + breakdown pie chart
│   ├── MaterialAlternatives.tsx 🆕 NEW — widget comparație 3 variante de material
│   └── BOMExportButton.tsx    🆕 NEW — buton export PDF cu loading state
│
├── components/construction/
│   ├── ConstructionTimeline.tsx 🆕 NEW — timeline vertical cu 7 etape
│   ├── PhaseChecklist.tsx     🆕 NEW — checklist materiale per etapă
│   └── BudgetOptimizer.tsx    🆕 NEW — widget AI optimizare cu SSE streaming
│
└── hooks/
    ├── useBOMData.ts          🆕 NEW — fetch + re-calculate BOM
    ├── useMaterialSelect.ts   🆕 NEW — state selecție materiale alternative
    └── usePriceUpdates.ts     🆕 NEW — polling prețuri + diff față de ultima versiune
```

---

## SCHEMA PRISMA — Extindere Faza 3

```prisma
// Catalog materiale — populat din data/materials-catalog.json
model Material {
  id           Int      @id @default(autoincrement())
  internalCode String   @unique // "bca-ytong-25cm", "bca-ytong-12cm"
  name         String   // "BCA Ytong 25cm"
  category     String   // "Zidărie" | "Fundație" | "Finisaje" | "Acoperiș" | "Tâmplărie"
  subcategory  String?  // "Pereți exteriori" | "Pereți interiori"
  unit         String   // "mp" | "mc" | "buc" | "kg" | "ml"
  pricePerUnit Float    // RON (prețul de bază din seedMaterials, actualizat prin scraping)
  brand        String?  // "Ytong" | "Tondach" | "Porta Doors"
  storeUrl     String?  // URL produs direct în magazin
  description  String?  // scurtă descriere tehnică
  uValue       Float?   // coeficient transmitanță termică (W/m²K) pentru calcul energetic
  isDefault    Boolean  @default(false) // materialul implicit pentru categoria sa
  alternatives Material[] @relation("MaterialAlternatives") // materiale alternative similare
  alternativeOf Material[] @relation("MaterialAlternatives")

  bomItems     ProjectBOM[]
  priceHistory PriceHistory[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([category])
  @@index([internalCode])
}

// Istoricul de preț — pentru grafice trend și alertă variație
model PriceHistory {
  id         Int      @id @default(autoincrement())
  materialId Int
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  price      Float
  scrapedAt  DateTime @default(now())
  source     String   // "leroy-merlin" | "dedeman" | "baumit" | "manual"

  @@index([materialId])
}

// Devizul proiectului — calculat automat, re-calculabil la schimbare materiale
model ProjectBOM {
  id          Int      @id @default(autoincrement())
  projectId   Int
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  materialId  Int
  material    Material @relation(fields: [materialId], references: [id])

  phase       String   // "Fundație" | "Structură" | "Planșeu" | "Acoperiș" | "Tâmplărie" | "Finisaje Brute" | "Finisaje Fine"
  formulaKey  String   // "wall_exterior_bca_25cm" — referință la formula folosită
  quantity    Float    // cantitatea calculată (după waste factor)
  unitPrice   Float    // prețul snapshot la momentul calculului
  totalPrice  Float    // quantity × unitPrice
  note        String?  // "24ml perete exterior × 2.7m înălțime = 64.8mp"

  createdAt   DateTime @default(now())

  @@index([projectId, phase])
}

// Etapele construcției — generate per proiect din construction-phases.json
model ConstructionPhase {
  id          Int      @id @default(autoincrement())
  projectId   Int
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  phaseOrder  Int      // 1-7 (ordinea cronologică)
  name        String   // "Fundație", "Structură", "Acoperiș" etc.
  description String?  // scurtă descriere a lucrărilor
  durationDays Int?    // estimare durata în zile (din construction-phases.json)
  isCompleted Boolean  @default(false) // utilizatorul poate bifa etapele completate
  completedAt DateTime?
  notes       String?  // note ale utilizatorului per etapă

  @@index([projectId])
  @@unique([projectId, phaseOrder])
}

// Extensii model Project
// estimatedCost  Float?  — suma totală BOM cu TVA (calculat și stocat la generate BOM)
// energyClass    String? — "A" | "B" | "C" | "D" | "E" | "F" | "G"
// energyKwhYear  Float?  — consum estimat kWh/mp/an
// bomGeneratedAt DateTime? — când a fost generat ultima oară BOM-ul
```

### Migrare:

```bash
npx prisma migrate dev --name "faza3_bom_materials_construction"
```

---

## TASK 1: Catalog Materiale & Seed

> **Strategia**: Pornim cu un catalog de bază (~50 materiale) exportat în `data/materials-catalog.json`, populat în DB prin `seedMaterials.ts`. Scraping-ul vine ulterior pe cron.

### Structura `data/materials-catalog.json`:

```json
[
  {
    "internalCode": "bca-ytong-25cm",
    "name": "BCA Ytong 25cm Clasa D3",
    "category": "Zidărie",
    "subcategory": "Pereți exteriori",
    "unit": "mp",
    "pricePerUnit": 85,
    "brand": "Ytong",
    "uValue": 0.45,
    "isDefault": true,
    "storeUrl": "https://www.leroymerlin.ro/categoria/bca",
    "description": "Bloc BCA pentru pereți exteriori, grosime 25cm",
    "alternatives": ["bca-ytong-30cm", "caramida-exterioara-30cm", "beton-celular-25cm"]
  },
  {
    "internalCode": "bca-ytong-12cm",
    "name": "BCA Ytong 12.5cm Clasa D4",
    "category": "Zidărie",
    "subcategory": "Pereți interiori",
    "unit": "mp",
    "pricePerUnit": 48,
    "brand": "Ytong",
    "uValue": 0.90,
    "isDefault": true
  },
  {
    "internalCode": "beton-b250-marfa",
    "name": "Beton C20/25 (B300) livrare cu autobetoniera",
    "category": "Fundație",
    "unit": "mc",
    "pricePerUnit": 620,
    "isDefault": true,
    "description": "Beton marfă pentru fundații, inclus transport 30km"
  },
  {
    "internalCode": "fier-beton-pc52-12",
    "name": "Fier beton PC52 Ø12mm colaci",
    "category": "Armătură",
    "unit": "kg",
    "pricePerUnit": 4.50,
    "isDefault": true,
    "storeUrl": "https://www.dedeman.ro/fier-beton"
  },
  {
    "internalCode": "tigla-ceramica-tondach",
    "name": "Țiglă ceramică Tondach Alpina Antracit",
    "category": "Acoperiș",
    "unit": "mp",
    "pricePerUnit": 135,
    "brand": "Tondach",
    "isDefault": true,
    "uValue": 0.20
  },
  {
    "internalCode": "usa-exterior-pal",
    "name": "Ușă exterior PVC cu geam 90×210cm",
    "category": "Tâmplărie",
    "subcategory": "Uși exterior",
    "unit": "buc",
    "pricePerUnit": 2400,
    "isDefault": true
  },
  {
    "internalCode": "usa-interior-porta",
    "name": "Ușă interior Porta Doors 90cm, furnir stejar",
    "category": "Tâmplărie",
    "subcategory": "Uși interior",
    "unit": "buc",
    "pricePerUnit": 850,
    "brand": "Porta Doors",
    "isDefault": true,
    "storeUrl": "https://www.dedeman.ro/usi-interior"
  },
  {
    "internalCode": "fereastra-pvc-3canate",
    "name": "Fereastră PVC tripanel Gealan 3 geamuri 120×140cm",
    "category": "Tâmplărie",
    "subcategory": "Ferestre",
    "unit": "buc",
    "pricePerUnit": 1350,
    "uValue": 0.70,
    "isDefault": true
  },
  {
    "internalCode": "sapa-ciment-m100",
    "name": "Șapă ciment M100 grosime 5cm (material+manoperă)",
    "category": "Finisaje Brute",
    "unit": "mp",
    "pricePerUnit": 35,
    "isDefault": true
  },
  {
    "internalCode": "tencuiala-mecanizata",
    "name": "Tencuială mecanizată 1.5cm interioară",
    "category": "Finisaje Brute",
    "unit": "mp",
    "pricePerUnit": 42,
    "isDefault": true
  },
  {
    "internalCode": "vata-bazaltica-10cm",
    "name": "Saltea vată bazaltică Knauf 10cm (termoizolație planșeu)",
    "category": "Izolație",
    "unit": "mp",
    "pricePerUnit": 55,
    "brand": "Knauf",
    "uValue": 0.04,
    "isDefault": true
  }
]
```

### `scripts/seedMaterials.ts`:

```typescript
// backend/src/scripts/seedMaterials.ts
import { PrismaClient } from '@prisma/client';
import catalogJSON from '../data/materials-catalog.json';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding materials catalog...');
  
  for (const mat of catalogJSON) {
    await prisma.material.upsert({
      where: { internalCode: mat.internalCode },
      update: { pricePerUnit: mat.pricePerUnit }, // actualizăm prețul dacă există
      create: {
        internalCode: mat.internalCode,
        name: mat.name,
        category: mat.category,
        subcategory: mat.subcategory,
        unit: mat.unit,
        pricePerUnit: mat.pricePerUnit,
        brand: mat.brand,
        uValue: mat.uValue,
        isDefault: mat.isDefault,
        storeUrl: mat.storeUrl,
        description: mat.description,
      }
    });
  }

  // Setup relații alternative după ce toate sunt create
  for (const mat of catalogJSON) {
    if (!mat.alternatives?.length) continue;
    const altMaterials = await prisma.material.findMany({
      where: { internalCode: { in: mat.alternatives } }
    });
    await prisma.material.update({
      where: { internalCode: mat.internalCode },
      data: { alternatives: { connect: altMaterials.map(m => ({ id: m.id })) } }
    });
  }

  console.log(`✅ Seeded ${catalogJSON.length} materials`);
}

main().finally(() => prisma.$disconnect());
```

---

## TASK 2: BOM Engine — Formule & Calcul

> **Principiu critic**: Formulele sunt în JSON, evaluate în service TypeScript cu **zero eval()**. Fiecare formulă referențiază un `materialId` și o expresie matematică cu variabile din `ProjectMetrics`.

### `data/bom-formulas.json` — Formule complete:

```json
{
  "foundation_concrete": {
    "materialCode": "beton-b250-marfa",
    "phase": "Fundație",
    "formula": "perimeter_m * foundation_width_m * foundation_depth_m",
    "wastePercent": 10,
    "note": "Beton fundație continuă sub pereții exteriori"
  },
  "foundation_rebar": {
    "materialCode": "fier-beton-pc52-12",
    "phase": "Fundație",
    "formula": "perimeter_m * 4 * foundation_depth_m * 0.888",
    "wastePercent": 8,
    "note": "4 bare Ø12mm pe înălțimea fundației, ~0.888 kg/ml"
  },
  "foundation_formwork": {
    "materialCode": "placaj-cofrare-18mm",
    "phase": "Fundație",
    "formula": "perimeter_m * foundation_depth_m * 2",
    "wastePercent": 15,
    "note": "Cofraje din placaj, 2 fețe"
  },
  "wall_exterior": {
    "materialCode": "bca-ytong-25cm",
    "phase": "Structură",
    "formula": "perimeter_m * floor_height_m * floors_count",
    "wastePercent": 5,
    "note": "BCA 25cm pereți exteriori (perimetrul casei × înălțimea per etaj × număr etaje)"
  },
  "wall_interior": {
    "materialCode": "bca-ytong-12cm",
    "phase": "Structură",
    "formula": "interior_walls_m * floor_height_m",
    "wastePercent": 5,
    "note": "BCA 12.5cm pereți interiori"
  },
  "slab_concrete": {
    "materialCode": "beton-b250-marfa",
    "phase": "Planșeu",
    "formula": "total_floor_area_sqm * 0.15 * (floors_count - 1)",
    "wastePercent": 8,
    "note": "Planșeu beton armat 15cm grosime, pentru etajele superioare"
  },
  "slab_rebar": {
    "materialCode": "fier-beton-pc52-12",
    "phase": "Planșeu",
    "formula": "total_floor_area_sqm * 12 * (floors_count - 1)",
    "wastePercent": 8,
    "note": "Armare planșeu bidirec. ~12kg/mp"
  },
  "roof_area": {
    "materialCode": "tigla-ceramica-tondach",
    "phase": "Acoperiș",
    "formula": "total_floor_area_sqm * 1.3 * 1.15",
    "wastePercent": 5,
    "note": "Tigla: suprafața pardoseală × 1.3 (pantă șarpantă) × 1.15 (suprapunere țigle)"
  },
  "roof_timber": {
    "materialCode": "lemn-rasinoase-ecarisat",
    "phase": "Acoperiș",
    "formula": "total_floor_area_sqm * 0.04",
    "wastePercent": 10,
    "note": "Șarpantă lemn ~0.04mc/mp pardoseală"
  },
  "floor_screed": {
    "materialCode": "sapa-ciment-m100",
    "phase": "Finisaje Brute",
    "formula": "total_floor_area_sqm * floors_count",
    "wastePercent": 3,
    "note": "Șapă 5cm pe toată suprafața desfășurată"
  },
  "wall_plaster": {
    "materialCode": "tencuiala-mecanizata",
    "phase": "Finisaje Brute",
    "formula": "(perimeter_m + interior_walls_m * 2) * floor_height_m",
    "wastePercent": 5,
    "note": "Tencuială pereți interior (ambele fețe pereți interiori)"
  },
  "door_exterior": {
    "materialCode": "usa-exterior-pal",
    "phase": "Tâmplărie",
    "formula": "count_exterior_doors",
    "wastePercent": 0,
    "note": "Ușile de intrare/ieșire exterioară"
  },
  "door_interior": {
    "materialCode": "usa-interior-porta",
    "phase": "Tâmplărie",
    "formula": "count_interior_doors",
    "wastePercent": 0,
    "note": "Uși interior per cameră"
  },
  "windows": {
    "materialCode": "fereastra-pvc-3canate",
    "phase": "Tâmplărie",
    "formula": "count_windows",
    "wastePercent": 0,
    "note": "Ferestre PVC standard"
  },
  "insulation_roof": {
    "materialCode": "vata-bazaltica-10cm",
    "phase": "Acoperiș",
    "formula": "total_floor_area_sqm",
    "wastePercent": 5,
    "note": "Termoizolație podul casei"
  }
}
```

### `bomService.ts` — Calculul propriu-zis:

```typescript
// backend/src/services/bomService.ts

// Variabilele disponibile pentru formule — extrase din DB și din planul 2D
interface ProjectMetrics {
  // Din Faza 1 (date tehnice)
  foundationDepthM: number;  // din minFoundationDepthCm / 100
  foundationWidthM: number;  // 0.5m pt P, 0.6m pt P+1, 0.8m pt P+2
  floorsCount: number;       // totalFloors din Project
  floorHeightM: number;      // 2.7m standard (configurabil)
  seismicZone: string;       // pentru ajustări structurale

  // Din planul 2D (Faza 2 — PlanSnapshot publicat)
  perimeterM: number;        // perimetrul exterior al casei
  totalFloorAreaSqm: number; // suma suprafețelor tuturor etajelor
  interiorWallsM: number;    // lungimea totală a pereților interiori (ml)
  countDoors: number;        // uși total
  countExteriorDoors: number;
  countInteriorDoors: number;
  countWindows: number;

  // Derivate (calculate în service)
  roofAreaSqm: number;       // totalFloorAreaSqm × 1.3 (pantă standard)
}

// Evaluare sigură a formulei matematice (fără eval())
function evaluateFormula(formulaStr: string, metrics: ProjectMetrics): number {
  // Replace variabile cu valorile din metrics
  const safeFormula = formulaStr
    .replace(/perimeter_m/g, metrics.perimeterM.toString())
    .replace(/foundation_width_m/g, metrics.foundationWidthM.toString())
    .replace(/foundation_depth_m/g, metrics.foundationDepthM.toString())
    .replace(/floor_height_m/g, metrics.floorHeightM.toString())
    .replace(/floors_count/g, metrics.floorsCount.toString())
    .replace(/total_floor_area_sqm/g, metrics.totalFloorAreaSqm.toString())
    .replace(/interior_walls_m/g, metrics.interiorWallsM.toString())
    .replace(/count_doors/g, metrics.countDoors.toString())
    .replace(/count_exterior_doors/g, metrics.countExteriorDoors.toString())
    .replace(/count_interior_doors/g, metrics.countInteriorDoors.toString())
    .replace(/count_windows/g, metrics.countWindows.toString());

  // Evaluare sigură: allow only numbers, operators, parentheses
  if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(safeFormula)) {
    throw new Error(`Formula nesigură: ${safeFormula}`);
  }
  return Function('"use strict"; return (' + safeFormula + ')')() as number;
}

async function calculateBOM(projectId: number): Promise<ProjectBOM[]> {
  const project = await projectRepository.findById(projectId);
  const snapshot = await editorRepository.getPublishedSnapshot(projectId);
  
  if (!snapshot) throw new Error('Nu există un plan publicat pentru acest proiect');

  const metrics = await extractMetrics(project, snapshot);
  const formulas = await loadBOMFormulas();
  const materials = await materialRepository.findAllWithCurrentPrices();
  const results: Omit<ProjectBOM, 'id' | 'createdAt'>[] = [];

  for (const [formulaKey, formula] of Object.entries(formulas)) {
    const rawQuantity = evaluateFormula(formula.formula, metrics);
    if (rawQuantity <= 0) continue;

    const quantityWithWaste = rawQuantity * (1 + formula.wastePercent / 100);
    const finalQty = Math.ceil(quantityWithWaste * 100) / 100; // 2 zecimale

    const material = materials.find(m => m.internalCode === formula.materialCode);
    if (!material) {
      console.warn(`Material necunoscut: ${formula.materialCode}`);
      continue;
    }

    results.push({
      projectId,
      materialId: material.id,
      phase: formula.phase,
      formulaKey,
      quantity: finalQty,
      unitPrice: material.pricePerUnit,
      totalPrice: parseFloat((finalQty * material.pricePerUnit).toFixed(2)),
      note: formula.note + ` (Q=${rawQuantity.toFixed(2)} + ${formula.wastePercent}% rebut)`,
    });
  }

  // Salvăm BOM în DB (înlocuim orice BOM anterior)
  await prisma.$transaction([
    prisma.projectBOM.deleteMany({ where: { projectId } }),
    prisma.projectBOM.createMany({ data: results }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        estimatedCost: results.reduce((sum, r) => sum + r.totalPrice, 0),
        bomGeneratedAt: new Date(),
      }
    })
  ]);

  return prisma.projectBOM.findMany({ where: { projectId }, include: { material: true } });
}
```

---

## TASK 3: Etapele Construcției

> Construcția are o ordine cronologică fixă și obligatorie. Generăm automat etapele per proiect din `construction-phases.json` la POST /api/bom/generate.

### `data/construction-phases.json`:

```json
[
  {
    "order": 1,
    "name": "Fundație",
    "description": "Săpătură, cofraje, armare, turnare beton, hidroizolație fundație",
    "durationDays": 14,
    "categories": ["Fundație"],
    "requiredPreviousPhase": null,
    "minimumIdle": 7,
    "idleNote": "7 zile maturare beton înainte de a ridica pereții"
  },
  {
    "order": 2,
    "name": "Structură — Zidărie",
    "description": "Ridicarea pereților exteriori și interiori din BCA / cărămidă, buiandrugi, stâlpișori",
    "durationDays": 21,
    "categories": ["Structură"],
    "requiredPreviousPhase": "Fundație"
  },
  {
    "order": 3,
    "name": "Planșeu & Coroană",
    "description": "Coroana de beton armat pe conturul clădirii, planșeul dintre etaje (dacă e P+1 sau mai mult)",
    "durationDays": 10,
    "categories": ["Planșeu"],
    "requiredPreviousPhase": "Structură — Zidărie",
    "minimumIdle": 14,
    "idleNote": "14 zile maturare planșeu beton armat"
  },
  {
    "order": 4,
    "name": "Acoperiș — Șarpantă & Învelitoare",
    "description": "Șarpantă lemn, folie anticondens, pazie, jgheaburi, învelitoare (țiglă/tablă)",
    "durationDays": 14,
    "categories": ["Acoperiș"],
    "requiredPreviousPhase": "Planșeu & Coroană"
  },
  {
    "order": 5,
    "name": "Tâmplărie Exterioară",
    "description": "Montaj ferestre PVC, ușă intrare principală, glafuri exterioare",
    "durationDays": 5,
    "categories": ["Tâmplărie"],
    "requiredPreviousPhase": "Acoperiș — Șarpantă & Învelitoare",
    "note": "Casa devine 'la roșu' după această etapă — se poate lucra pe orice vreme"
  },
  {
    "order": 6,
    "name": "Instalații & Finisaje Brute",
    "description": "Instalații electrice (cablare), sanitare (țevi), termice, șapă, tencuieli, glet",
    "durationDays": 30,
    "categories": ["Finisaje Brute"],
    "requiredPreviousPhase": "Tâmplărie Exterioară"
  },
  {
    "order": 7,
    "name": "Finisaje Fine",
    "description": "Vopsele, gresie, faianță, parchet, uși interior, corpuri iluminat, sanitare montaj",
    "durationDays": 30,
    "categories": ["Finisaje Fine"],
    "requiredPreviousPhase": "Instalații & Finisaje Brute"
  }
]
```

### Timeline vizual (ConstructionTimeline.tsx):

```
Etapa 1: Fundație ━━━━━━━━━━━━━━ 14 zile                          ✅ Completat
         ⏸ Așteptare 7 zile maturare beton
Etapa 2: Zidărie ━━━━━━━━━━━━━━━━━━━━━ 21 zile                    ⏳ În curs
         ⏸ Așteptare 14 zile planșeu
Etapa 3: Planșeu ━━━━━━━━━━━━━━ 10 zile                           🔒 Blocat
Etapa 4: Acoperiș ━━━━━━━━━━━━━━ 14 zile                          🔒 Blocat
Etapa 5: Tâmplărie ━━━━━ 5 zile                                   🔒 Blocat
                   ★ CASA LA ROȘU (milestone)
Etapa 6: Instalații & Brute ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 30z   🔒 Blocat
Etapa 7: Finisaje Fine ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 30z    🔒 Blocat

TOTAL ESTIMAT: ~141 zile + 21 zile așteptare = ~162 zile (~5.5 luni)
```

---

## TASK 4: Selecție Materiale & Alternative

> Utilizatorul poate înlocui orice material implicit cu o alternativă. BOM-ul se recalculează instant cu noul preț.

### Variante de materiale (exemplu zidărie exterioară):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Zidărie Exterioară — alege varianta potrivită pentru tine           │
├──────────────────┬──────────────────┬─────────────────────────────── │
│ BCA Ytong 25cm   │ Cărămidă 30cm    │ Beton Celular Aeroc 25cm       │
│ ████████████████ │ ████████████████ │ ████████████████               │
│ 85 RON/mp        │ 120 RON/mp       │ 78 RON/mp                      │
│ U=0.45 W/m²K     │ U=0.85 W/m²K    │ U=0.42 W/m²K                  │
│ Impact deviz:    │ Impact deviz:    │ Impact deviz:                   │
│ 0 RON (baza)     │ +8,400 RON 📈   │ -840 RON 📉                    │
│ Clasă: B         │ Clasă: D        │ Clasă: B                        │
│ [✓ Selectat]     │ [Alege]          │ [Alege]                        │
└──────────────────┴──────────────────┴────────────────────────────────┘
```

### Endpoint selecție material:

```
PATCH /api/bom/:projectId/material
Body: { formulaKey: "wall_exterior", newMaterialCode: "caramida-exterioara-30cm" }
Response: { updatedBOMItems: [...], newTotal: 158400, delta: 8400 }
```

---

## TASK 5: Prețuri Live (Price Service)

> **Strategie**: Prețuri de bază în JSON. Cron job săptămânal care scrapează Leroy Merlin + Dedeman. Alertă automată dacă prețul variază >15% față de săptămâna anterioară.

### `priceService.ts`:

```typescript
class PriceService {
  // Returnează prețul curent din DB (ultima actualizare scrapată sau manuală)
  async getCurrentPrice(materialId: number): Promise<number> {
    const latest = await prisma.priceHistory.findFirst({
      where: { materialId },
      orderBy: { scrapedAt: 'desc' }
    });
    if (!latest) {
      const material = await prisma.material.findUnique({ where: { id: materialId } });
      return material?.pricePerUnit ?? 0;
    }
    return latest.price;
  }

  // Cron job — rulează duminică la 03:00
  // Puppeteer headless → pagini produs → extrage prețul → salvează PriceHistory
  async scrapeAndUpdatePrices(): Promise<void> {
    const materials = await prisma.material.findMany({ where: { storeUrl: { not: null } } });
    for (const mat of materials) {
      try {
        const newPrice = await this.scrapePrice(mat.storeUrl!);
        const previousPrice = await this.getCurrentPrice(mat.id);

        await prisma.priceHistory.create({
          data: { materialId: mat.id, price: newPrice, source: 'auto-scraping' }
        });

        // Alertă CEO dacă variația > 15%
        if (Math.abs(newPrice - previousPrice) / previousPrice > 0.15) {
          await alertService.sendPriceAlert(mat.name, previousPrice, newPrice);
        }
      } catch (err) {
        console.warn(`Scraping eșuat pentru ${mat.name}:`, err);
      }
    }
  }
}
```

### Afișare trend preț:

```
Material: BCA Ytong 25cm
Prețul din ultimele 8 săptămâni:
  82 → 83 → 85 → 85 → 87 → 85 → 84 → 85 RON/mp
  📈 +3.7% față de acum 2 luni
  [Actualizat: 06 Apr 2026, Sursa: Leroy Merlin]
```

---

## TASK 6: Optimizare Buget AI (RAG)

> AI-ul Zidario analizează devizul complet și sugerează unde poți économiza fără a compromite siguranța sau calitatea. Sursa: RAG din normativele de materiale + catalog prețuri.

### Prompt orchestrator `budgetOptimizer.ts`:

```typescript
async function* optimizeBudget(
  projectId: number,
  totalEstimate: number,
  userBudget?: number,
  focusArea?: 'cost' | 'energy' | 'speed'
): AsyncGenerator<string> {
  const bom = await prisma.projectBOM.findMany({
    where: { projectId }, include: { material: true }
  });

  const bomSummary = bom
    .map(b => `- ${b.material.name} (${b.phase}): ${b.quantity} ${b.material.unit} × ${b.unitPrice} RON = ${b.totalPrice} RON`)
    .join('\n');

  // RAG — căutăm alternative de materiale relevante din normative + catalog
  const ragContext = await ragService.searchRelevantChunks(
    'materiale alternative mai ieftine constructie rezidentiala calitate',
    ['NE012-2022', 'CR6-2013']
  );

  const prompt = `
    Ești Zidario, asistentul tehnic BuildWise.
    Analizezi devizul de materiale al unui proiect rezidențial și sugerezi optimizări.

    DEVIZ CURENT (total: ${totalEstimate.toLocaleString()} RON):
    ${bomSummary}

    ${userBudget ? `BUGETUL DISPONIBIL AL UTILIZATORULUI: ${userBudget.toLocaleString()} RON` : ''}
    ${focusArea === 'energy' ? 'PRIORITATEA UTILIZATORULUI: Clasă energetică mai bună.' : ''}
    ${focusArea === 'speed' ? 'PRIORITATEA UTILIZATORULUI: Durată construcție mai scurtă.' : ''}

    SARCINI:
    1. Identifică TOP 3 categorii unde costul e cel mai ridicat ca procent din total.
    2. Sugerează material alternativ concret pentru fiecare (cu economie estimată în RON).
    3. Avertizează dacă vreun material nu respectă normativele (CR6-2013, NE012-2022).
    4. Dacă bugetul e specificat și devizul îl depășește, dă prioritate celor mai mari economii.

    RĂSPUNS: concis, structurat, cu sume concrete. Nu inventa prețuri — folosește doar datele din devizul primit.

    CONTEXT NORMATIVE (RAG):
    ${ragContext.map(c => c.content).join('\n\n')}
  `;

  yield* geminiStreamText(prompt);
}
```

---

## TASK 7: Estimare Clasă Energetică

> **Diferențiator de produs**: Niciun tool din România nu face asta automat pentru locuințe individuale. MC 001-2022 definește metodologia oficială. Noi implementăm o estimare orientativă corectă ingineristic.

### `energyClassService.ts`:

```typescript
// data/energy-classes.json
const U_VALUES: Record<string, number> = {
  'bca-ytong-25cm': 0.45,
  'bca-ytong-25cm-eif10': 0.22,  // cu strat 10cm EIF
  'caramida-exterioara-30cm': 0.85,
  'fereastra-pvc-2canate': 1.10,
  'fereastra-pvc-3canate': 0.70,
  'tigla-ceramica-tondach': 1.20, // fără izolație pod
  'vata-bazaltica-10cm': 0.04,    // izolație pod
};

const ENERGY_CLASS_THRESHOLDS = [
  { class: 'A++', maxKwhSqmYear: 15 },
  { class: 'A+',  maxKwhSqmYear: 25 },
  { class: 'A',   maxKwhSqmYear: 50 },
  { class: 'B',   maxKwhSqmYear: 75 },
  { class: 'C',   maxKwhSqmYear: 100 },
  { class: 'D',   maxKwhSqmYear: 125 },
  { class: 'E',   maxKwhSqmYear: 150 },
  { class: 'F',   maxKwhSqmYear: 175 },
  { class: 'G',   maxKwhSqmYear: Infinity },
];

interface EnergyClassResult {
  class: string;             // "B"
  kwhPerSqmYear: number;    // consum estimat
  heatingLossW: number;     // pierderi termice W/K
  recommendations: string[]; // ce să schimbe pt a urca o clasă
  savedCoast?: number;       // diferența de cost față de opțiunile default (RON)
}

function estimateEnergyClass(
  totalFloorAreaSqm: number,
  wallCode: string,
  windowCode: string,
  roofInsulationCode: string | null,
  streetOrientation: string, // din Faza 1 — sud = bonus solar pasiv ~5%
): EnergyClassResult {

  const wallU = U_VALUES[wallCode] ?? 0.85;
  const windowU = U_VALUES[windowCode] ?? 1.40;
  const roofU = roofInsulationCode ? U_VALUES[roofInsulationCode] : 0.90;

  // Suprafețe de calcul (estimări standard pentru o casă rectangulară)
  const wallArea = Math.sqrt(totalFloorAreaSqm) * 4 * 2.7; // perimetru × înălțime
  const windowArea = totalFloorAreaSqm * 0.15;             // ferestre ~15% din pardoseală
  const roofArea = totalFloorAreaSqm;

  // Transmitanță termică globală
  const UA = wallU * wallArea + windowU * windowArea + roofU * roofArea;

  // Heating Degree Days România: ~3000 HDD/an (medie națională; Suceava 3500, Constanța 2200)
  const HDD = 3000;
  const solarBonus = streetOrientation.startsWith('S') ? 0.05 : 0;
  const annualHeatKwh = (UA * HDD * 24 / 1000) * (1 - solarBonus);
  const kwhPerSqmYear = Math.round(annualHeatKwh / totalFloorAreaSqm);

  const energyClass = ENERGY_THRESHOLDS.find(t => kwhPerSqmYear <= t.maxKwhSqmYear)?.class ?? 'G';

  const recommendations: string[] = [];
  if (wallU > 0.3)   recommendations.push('Adaugă strat EIF 10cm pe pereți exteriori → câștig ~2 clase energetice');
  if (windowU > 0.9) recommendations.push('Treci la ferestre PVC tripanel low-e → economie ~8% consum anual');
  if (!roofInsulationCode) recommendations.push('Izolează podul cu vată bazaltică 15cm → cea mai ieftină intervenție');

  return { class: energyClass, kwhPerSqmYear, heatingLossW: Math.round(UA), recommendations };
}
```

---

## TASK 8: Export PDF Final Complet

> Cel mai complet document generat de BuildWise: plan 2D + date tehnice + deviz pe etape + total + clasă energetică. Utilizatorul îl poate prezenta arhitectului sau băncii.

### Structura PDF (Puppeteer, ~6-8 pagini A4):

```
Pagina 1 — Copertă (Cover)
  • Logo BuildWise
  • Titlul proiectului
  • Adresă: Județ X, Localitate Y
  • Data generării
  • Rezumat: Suprafață desfășurată XXXmp | Regim: P+1 | Stil: Modern | Clasă: B

Pagina 2 — Fișă Tehnică
  • Zonă seismică: 0.20g (P100-1/2013)
  • Adâncime minimă fundare: -100cm (NP112-2014)
  • Regim înălțime permis: P+2 maxim
  • Suprafața terenului: 500mp | Suprafață construită: 80mp | Suprafață desfășurată: 130mp
  • Configurație: Cu subsol / Parter / 1 Etaj / Fără mansardă

Pagina 3 — Planul Parterului (PNG din Faza 2)
  • Imagine plan 2D (A4 landscape)
  • Scara 1:100 | Orientare Nord
  • Legendă simboluri

Pagina 4 — Rezumat Camere & Conformitate
  • Tabel: Cameră | Suprafață utilă | Minim legal | Status
  • Mențiune: "Plan conform Legea 114/1996" sau lista violărilor

Pagina 5 — Clasă Energetică
  • Badge vizual: Clasa B (verde)
  • Consum estimat: 68 kWh/mp/an
  • Comparație cu clasele A și C
  • Top 3 recomandări de îmbunătățire

Pagina 6+ — Deviz de Materiale per Etapă
  • Secțiune per fiecare etapă (Fundație, Structură, etc.)
  • Tabel: Material | Unitate | Cantitate | Preț unitar | Total
  • Subtotal etapă
  • SUMAR FINAL: Total fără TVA | TVA 19% | TOTAL CU TVA
  • Notă: "Prețuri valabile la data de XX. Estimare orientativă."

Pagina ultimă — Disclaimer & Date Contact
  • "Devizul este generat automat de BuildWise pe baza datelor furnizate."
  • "Nu înlocuiește un deviz oficial semnat de inginer constructor autorizat."
```

---

## TASK 9: Pagina BOM (ProjectBOM.tsx)

### Layout pagina deviz:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Proiectul Meu     Deviz de Materiale                 [Export PDF]  │
├───────────────────────────────────────────┬──────────────────────────┤
│                                           │   SUMAR                  │
│ ▼ ETAPA 1: FUNDAȚIE                      │                          │
│ Beton C20/25        12 mc × 620 = 7,440 │   Fundație:   12,300 RON │
│ Fier PC52 Ø12mm    380 kg × 4.5 = 1,710 │   Structură:  24,600 RON │
│ Placaj cofrare      48 mp × 65  = 3,120 │   Planșeu:     8,400 RON │
│                    ─────────── 12,270 ◀ │   Acoperiș:   18,700 RON │
│                                           │   Tâmplărie:  15,800 RON │
│ ▶ ETAPA 2: STRUCTURĂ (click expand)      │   Fin. Brute: 11,200 RON │
│ ▶ ETAPA 3: PLANȘEU                       │   Fin. Fine:  22,000 RON │
│ ▶ ETAPA 4: ACOPERIȘ                      │   ─────────────────────── │
│ ▶ ETAPA 5: TÂMPLĂRIE                     │   Fără TVA:  113,000 RON │
│ ▶ ETAPA 6: FINISAJE BRUTE                │   TVA 19%:    21,470 RON │
│ ▶ ETAPA 7: FINISAJE FINE                 │   TOTAL:     134,470 RON │
│                                           │                          │
│ 🤖 Zidario: "Poți economisi ~9,200 RON   │   [Regenerează deviz]    │
│ dacă alegi BCA Aeroc în loc de Ytong     │   [Optimizare buget AI]  │
│ pentru pereții interiori..."  [Citește+] │   [Export PDF]           │
└───────────────────────────────────────────┴──────────────────────────┘
```

---

## ORDINEA DE IMPLEMENTARE (Sprint Plan Faza 3)

```
Sprint 1 (3-4 zile) — Catalog & Seed:
  [ ] Schema Prisma (Material, PriceHistory, ProjectBOM, ConstructionPhase) + migrare
  [ ] data/materials-catalog.json — catalog complet ~50 materiale
  [ ] data/bom-formulas.json — formule complete per categorie constructivă
  [ ] data/construction-phases.json — etapele construcției
  [ ] scripts/seedMaterials.ts — populare DB
  [ ] GET /api/materials — endpoint catalog materiale cu filtrare pe categorie

Sprint 2 (3-4 zile) — BOM Engine:
  [ ] extractMetrics() — extragere date din Project + PlanSnapshot publicat
  [ ] bomService.ts — evaluare formule + asamblare BOM complet
  [ ] POST /api/bom/generate/:projectId — generare calcul deviz
  [ ] GET /api/bom/:projectId — devizul curent per proiect
  [ ] PATCH /api/bom/:projectId/material — schimbare material + recalcul instant
  [ ] BOMStageCard.tsx + BOMTable.tsx — afișare deviz expandabil per etapă
  [ ] BOMSummary.tsx — sumar total + breakdown pe categorii

Sprint 3 (2-3 zile) — Etape Construcție & Timeline:
  [ ] POST /api/construction/generate/:projectId — generare etape din JSON
  [ ] GET /api/construction/:projectId — etapele cu progres
  [ ] PATCH /api/construction/:projectId/phase/:order/complete — marcare etapă completă
  [ ] ConstructionTimeline.tsx — timeline vizual cu 7 etape + status blocat/activ/completat
  [ ] PhaseChecklist.tsx — materialele per etapă cu link magazin
  [ ] ProjectTimeline.tsx — pagina completă

Sprint 4 (2-3 zile) — Materiale Alternative & Prețuri:
  [ ] GET /api/materials/:code/alternatives — alternative cu impact preț în deviz
  [ ] MaterialAlternatives.tsx — widget comparație 3 variante + impact pe deviz
  [ ] priceService.ts — getCurrentPrice() cu fallback pe pricePerUnit din DB
  [ ] GET /api/bom/prices — prețurile actuale ale materialelor din deviz
  [ ] usePriceUpdates.ts — polling 1 oră + diff față de versiunea anterioară

Sprint 5 (2-3 zile) — AI Optimizare & Clasă Energetică:
  [ ] budgetOptimizer.ts — agentOrchestrator.optimizeBudget() cu SSE
  [ ] POST /api/ai/optimize-budget (SSE streaming)
  [ ] BudgetOptimizer.tsx — panel cu streaming text + buton "Aplică recomandarea"
  [ ] energyClassService.ts — estimareEnergyClass() cu U-values din materiale selectate
  [ ] GET /api/bom/energy-class/:projectId
  [ ] EnergyClassCard.tsx — badge clasă + kWh/mp/an + top 3 recomandări

Sprint 6 (2-3 zile) — Export PDF Final & Polish:
  [ ] exportService.ts — template HTML multipaginal + Puppeteer
  [ ] GET /api/export/full-pdf/:projectId — PDF complet (plan + deviz + clasă energetică)
  [ ] BOMExportButton.tsx — buton cu loading state + download
  [ ] Integrare ProjectDetail.tsx — link "Deschide Deviz" + badge clasă energetică
  [ ] Cron job scraping prețuri săptămânal (node-cron)
```

---

## API ENDPOINTS FAZA 3

```
# Catalog Materiale
GET    /api/materials                        → Lista catalog cu filtrare ?category=
GET    /api/materials/:code/alternatives     → Alternative la un material + impact deviz

# BOM — Deviz
POST   /api/bom/generate/:projectId         → Generare calcul complet deviz
GET    /api/bom/:projectId                  → Devizul curent (per fază + per material)
PATCH  /api/bom/:projectId/material         → Schimbare material + recalcul instant
GET    /api/bom/prices                      → Prețurile curente materialele din deviz
GET    /api/bom/price-history/:materialId   → Istoricul prețului (grafic trend)

# Etape Construcție
POST   /api/construction/generate/:projectId → Generare etape din JSON standard
GET    /api/construction/:projectId          → Etapele cu status și durate
PATCH  /api/construction/:id/complete        → Marcare etapă completată

# AI
POST   /api/ai/optimize-budget               → SSE: optimizare buget AI + alternative
GET    /api/bom/energy-class/:projectId      → Estimare clasă energetică

# Export
GET    /api/export/full-pdf/:projectId       → PDF complet (plan + deviz + clasă energetică)
```

---

## DECIZII ARHITECTURALE FAZA 3

| Decizie | Alegere | Motivare |
|---|---|---|
| **Calcul BOM** | Formule JSON evaluate (nu AI) | Datele financiare nu se lasă pe seama LLM. Formulele sunt auditabile, fără code deploy. |
| **Evaluare formule** | Custom evaluator (nu `eval()`) | Securitate — `eval()` e risc XSS/injection. Evaluatorul nostru admite DOAR operatori matematici. |
| **Prețuri** | JSON local + cron scraping săptămânal | Real-time scraping = risc ban + latentă. Prețurile materialelor de construcție se schimbă lunar, nu zilnic. |
| **Alternativ materiale** | Relație Many-to-Many în Prisma | Fiecare material poate avea mai multe alternative și poate fi alternativă la mai multe materiale. |
| **Etape construcție** | JSON constant + generare per proiect în DB | Etapele sunt standard (7 faze fixe). Generăm instanțe per proiect pentru a permite marcat progresul. |
| **Clasă energetică** | Formula simplificată (nu API extern) | Zero cost, zero dependency. Estimare orientativă — suficientă pentru MVP și corectă ingineristic. |
| **Export PDF** | Puppeteer + HTML template multipaginal | jsPDF are limitări severe la tabele complexe. Puppeteer renderizează identic cu browser-ul. |
| **AI optimizare buget** | RAG normative + date deviz injectate manual | AI-ul nu are acces direct la DB. Primește devizul ca text în prompt — răspuns corect și auditat. |

---

## LIVRABILE FAZA 3

La finalul Fazei 3, aplicația va putea:

1. ✅ Genera automat devizul de materiale din planul 2D + datele tehnice din Faza 1
2. ✅ Afișa devizul organizat pe 7 etape cronologice de construcție
3. ✅ Permite selecția alternativelor de materiale cu recalcul instant al devizului
4. ✅ Afișa prețurile actualizate ale materialelor (cron săptămânal Leroy Merlin / Dedeman)
5. ✅ Genera optimizări de buget asistată de AI (SSE streaming) cu economii concrete în RON
6. ✅ Estima clasa energetică a casei (A→G) pe baza materialelor selectate
7. ✅ Exporta PDF-ul final complet: plan 2D + fișă tehnică + deviz per etapă + clasă energetică
8. ✅ Permite utilizatorului să marcheze etapele construcției ca finalizate (tracking progres)

> **Input Faza 4** (opțional): Datele de progres din ConstructionPhase + devizul real vs. estimat → dashboard project management cu analiza cost overrun.
