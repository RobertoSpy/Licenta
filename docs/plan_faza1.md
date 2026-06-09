# Plan Implementare — Faza 1: Pregătire Teren și Configurare Casă (Screen 1-4)

> **Nivel**: Senior Software Developer
> **Arhitectura**: Monolitic Modular — `Routes → Controllers → Services → Repositories → DB (Prisma)`
> **Principiu AI**: Componenta AI este **un modul separat, injectabil**, nu cuplată la business logic. Poate fi înlocuită sau vândută independent unui retailer (B2B).

---

## STADIU ACTUAL (ce există deja)

| Componentă | Status |
|---|---|
| Auth (Login/Register/Refresh/Logout) | ✅ Complet |
| Wizard UI (3 pași, animații Framer Motion) | ✅ Complet vizual |
| Step1: Hartă Leaflet + click pe coordonate | ✅ Funcțional UI |
| Step2: Input sol, dimensiuni teren | ✅ Funcțional UI |
| Step3: Stil casă, nr. etaje | ✅ Funcțional UI |
| Salvare în DB la Finalizează | ❌ TODO (doar console.log) |
| Date seismice / îngheț / județ auto | ❌ Neimplementat |
| RAG / CAG / AI Agent | ❌ Neimplementat |
| Schema Prisma extinsă (teren complet) | ❌ Incompletă (doar plotWidth/plotLength) |
| pgvector setup în PostgreSQL | ❌ Neimplementat |

---

## STRATEGIE AI: RAG + CAG — Combinația Corectă

### Diferența fundamentală:

| | RAG | CAG |
|---|---|---|
| **Cum funcționează** | Caută în documente la runtime pe baza întrebării | Preîncarcă documentele în contextul modelului o singură dată |
| **Latență** | 1-3s per query (embedding + similarity search) | Zero — deja în context |
| **Cost tokene** | Plătești la fiecare query | Plătești o dată per sesiune |
| **Când se folosește** | Date dinamice (prețuri, specificații) | Date statice (normative, legi neschimbate) |

### Strategia Zidario:

```
CAG → pentru normativele statice (P100, NP112, CR6, Legea 10/1995)
      Le încarci o dată în system prompt → rămân în contextul sesiunii
      Gemini 2.5 Pro are 1 milion de tokene context window — perfect pentru asta

RAG → pentru prețuri materiale și date dinamice
      (PriceHistory, specificații produse din scraping)
      Le cauți la runtime pentru că se schimbă zilnic
```

### Implementare `agentOrchestrator.ts`:

```typescript
// Normativele statice se încarcă O DATĂ la pornirea serverului
const STATIC_NORMATIVE_CACHE = await loadNormativeCache();

async function buildSystemPrompt(screen: string): Promise<string> {
  return `
    Ești asistentul tehnic Zidario.
    Răspunzi DOAR pe baza normativelor de mai jos.
    Nu inventa date. Citează capitolul exact când dai un număr.

    === NORMATIVE ÎNCĂRCATE (CAG — statice) ===
    ${STATIC_NORMATIVE_CACHE}

    === DATE DINAMICE (RAG — runtime) ===
    ${await ragService.searchRelevantChunks(screen)}
  `;
}
```

> **IMPORTANT**: `STATIC_NORMATIVE_CACHE` nu înseamnă toate PDF-urile brut în memorie.
> Înseamnă **tabelele de valori critice** extrase și formatate:
> - P100: zona seismică per județ (~2KB)
> - NP112: adâncime îngheț per județ (~1KB)
> - Legea 114/1996: suprafețe minime camere (~500 bytes)
> Textul explicativ al normativelor rămâne în pgvector, căutat prin RAG la nevoie.

---

## NORMATIVELE COMPLETE — Lista pentru Zidario

### Grupa 1 — Cadru legal (obligatorii în licență)

| Act | Relevanță pentru Zidario |
|---|---|
| **Legea 50/1991** | Autorizare construire — Screen 3 afișează dacă e necesară |
| **Legea 10/1995** | Calitatea construcțiilor — fundamentează toate verificările |
| **HGR 766/1997** | Clase de importanță clădiri — determină cerințele structurale |
| **Legea 114/1996** | Suprafețe minime locuință — validare editor 2D (Faza 2) |

### Grupa 2 — Normative structurale (pentru agentul RAG)

| Normativ | Relevanță pentru Zidario |
|---|---|
| **P100-1/2013** | Zonă seismică din GPS → cerințe fundație |
| **NP 112-2014** | Adâncime îngheț → tip fundație recomandat |
| **CR 6-2013** | Structuri zidărie → validare plan 2D pereți |
| **NE 012-1:2022** | Beton și armare → deviz materiale fundație |
| **CR 1-1-3/2012** | Zăpadă → calcul structură acoperiș |
| **CR 1-1-4/2012** | Vânt → calcul structură |

### Grupa 3 — Normative instalații (pentru Faza 3)

| Normativ | Relevanță pentru Zidario |
|---|---|
| **I7-2011** | Instalații electrice → etapa "la gri" din deviz |
| **I9-2015** | Instalații sanitare → etapa instalații |
| **I13-2015** | Instalații termice → etapa încălzire |
| **P118/1-2025** | Securitate incendiu → verificare plan 2D |

### Grupa 4 — Eficiență energetică (diferențiator de produs)

| Act | Relevanță pentru Zidario |
|---|---|
| **Legea 372/2005** | Performanță energetică clădiri → clasă energetică estimată |
| **MC 001-2022** | Metodologie calcul performanță energetică |

> **Nota**: Estimarea clasei energetice pe baza materialelor alese (Faza 3) este un diferențiator puternic — niciun competitor din România nu face asta automat.

---

## ARHITECTURA MODULARĂ (structura de fișiere țintă)

```
backend/src/
├── routes/
│   ├── authRoutes.ts          ✅ EXISTS
│   ├── projectRoutes.ts       ✅ EXISTS (va fi extins)
│   ├── terrainRoutes.ts       🆕 NEW
│   └── aiRoutes.ts            🆕 NEW (modul AI izolat)
│
├── controllers/
│   ├── authController.ts      ✅ EXISTS
│   ├── projectController.ts   ✅ EXISTS (va fi extins)
│   ├── terrainController.ts   🆕 NEW
│   └── aiController.ts        🆕 NEW (cu streaming SSE)
│
├── services/
│   ├── projectService.ts      🆕 NEW
│   ├── terrainService.ts      🆕 NEW
│   ├── geospatialService.ts   🆕 NEW (GPS → județ, seismic, îngheț)
│   └── ai/
│       ├── agentOrchestrator.ts   🆕 NEW (creierul AI — RAG+CAG)
│       ├── ragService.ts          🆕 NEW (similarity search în pgvector)
│       ├── embeddingService.ts    🆕 NEW (Gemini text-embedding-004)
│       └── normativeCache.ts      🆕 NEW (CAG — încărcare statică la boot)
│
├── repositories/
│   ├── userRepository.ts      🆕 NEW
│   ├── projectRepository.ts   🆕 NEW
│   └── terrainRepository.ts   🆕 NEW
│
├── middleware/
│   ├── authMiddleware.ts      ✅ EXISTS
│   ├── validateMiddleware.ts  🆕 NEW (Zod schema validation)
│   └── tenantMiddleware.ts    🆕 NEW (RLS application-level)
│
├── scripts/
│   └── seedNormatives.ts      🆕 NEW (procesare PDF → chunks → embeddings → DB)
│
├── types/
│   └── terrain.ts             🆕 NEW (TerrainPolygon, ProjectContext etc.)
│
└── data/
    ├── seismic-zones.json     🆕 DATA FILE (P100-1/2013 — zone seismice România)
    ├── frost-depth.json       🆕 DATA FILE (NP112-2014 — adâncime îngheț)
    ├── floor-rules.json       🆕 DATA FILE (reguli etaje per zonă seismică + tip sol)
    └── normative/             🆕 PDF-urile normativelor (procesat cu seedNormatives.ts)
        ├── P100-1-2013.pdf
        ├── NP112-2014.pdf
        ├── CR6-2013.pdf
        └── Legea114-1996.pdf

frontend/src/
├── components/wizard/
│   ├── ProjectWizard.tsx      ✅ EXISTS — extins la 4 pași + WizardContext
│   ├── Step1Location.tsx      ✅ EXISTS — Flux A (GPS) + Flux B (dreptunghi simplu)
│   ├── Step2Terrain.tsx       ✅ EXISTS — adăugat pantă + orientare + AI chat
│   ├── Step3Regulations.tsx   🆕 NEW (Screen 3 — normative + streaming AI)
│   └── Step4HouseType.tsx     🆕 NEW (Screen 4 — tipul de casă)
│
├── components/ai/
│   ├── AIChatBubble.tsx       🆕 NEW (widget chat refolosibil, cu streaming)
│   └── AIInsightCard.tsx      🆕 NEW (card cu rezumat normative)
│
├── context/
│   ├── AuthContext.tsx         ✅ EXISTS
│   └── WizardContext.tsx       🆕 NEW (projectId + wizardStep — sursa de adevăr)
│
├── middleware/
│   └── useProjectGuard.ts     🆕 NEW (blochează skip de pași)
│
└── api/
    ├── axios.ts               ✅ EXISTS
    ├── terrainApi.ts          🆕 NEW
    └── aiApi.ts               🆕 NEW (inclusiv SSE handler pentru streaming)
```

---

## TASK 1: Extindere Schema Prisma

**Fișier**: `backend/prisma/schema.prisma`

### Model `Project` — extindere completă:

```prisma
model Project {
  id     Int    @id @default(autoincrement())
  title  String
  userId Int
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // === SCREEN 1: Identificare Teren ===
  lat               Float?
  lng               Float?
  // polygonGeoJSON stochează Json — suprafața se calculează în backend cu turf.js
  // și se salvează în plotAreaSqm. Nu se recalculează la citire.
  polygonGeoJSON    Json?
  county            String?
  locality          String?
  seismicZone       String?   // "0.10g" | "0.15g" | "0.20g" | "0.25g" | "0.30g" | "0.35g"
  frostDepthCm      Int?
  plotAreaSqm       Float?    // calculat cu turf.js la salvare, stocat aici

  // === SCREEN 2: Caracteristici Teren ===
  soilType          String?   // "Argilos" | "Nisipos" | "Pietros" | "Stâncos" | "Necunoscut"
  slopePercent      Float?
  streetOrientation String?   // "N" | "NE" | "E" | "SE" | "S" | "SV" | "V" | "NV"
  soilNotes         String?

  // === SCREEN 3: Reglementări (generate de AI, salvate pentru referință) ===
  maxAllowedFloors     Int?
  minFoundationDepthCm Int?
  zoningRestrictions   String?

  // === SCREEN 4: Tipul Casei ===
  houseStyle       String?   // "Modern" | "Industrial" | "Clasic" | "Mediteranean"
  hasBasement      Boolean   @default(false)
  hasGroundFloor   Boolean   @default(true)
  upperFloorsCount Int       @default(0)
  hasMansard       Boolean   @default(false)
  totalFloors      Int?      // calculat: basement(0/1) + parter(1) + etaje + mansardă(0/1)

  // Starea Wizard-ului — DB este sursa de adevăr
  wizardStep   Int     @default(1)
  isCompleted  Boolean @default(false)

  bomItems  ProjectBOM[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([userId])
}

// === PENTRU RAG ===
model NormativeChunk {
  id        Int    @id @default(autoincrement())
  source    String // "NP112-2014" | "P100-2013" | "CR6-2013" etc.
  chapter   String // "Cap.3 - Identificarea vizuală a solului"
  content   String // 800-1000 cuvinte per chunk
  embedding Unsupported("vector(768)")?

  @@index([source])
}
```

### Tipizare explicită pentru polygonGeoJSON:

```typescript
// backend/src/types/terrain.ts
export interface TerrainPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // GeoJSON standard
  areaSqm: number; // calculat cu turf.js în backend la salvare
}
```

### Migrare:

```bash
npx prisma migrate dev --name "extend_project_wizard_phase1"
```

---

## TASK 2: pgvector — Setup în Sprint 1 (nu Sprint 3!)

> **De ce în Sprint 1?** Dacă descoperi că pgvector nu merge cu versiunea ta de PostgreSQL din Docker abia în Sprint 3, când ai tot AI-ul scris, remedierea e costisitoare. Îl testezi în zilele 1-2, ai timp de reacție.

### Testare imediată după pornirea containerului:

```bash
docker exec -it <postgres_container_name> psql -U buildwise_user -d buildwise_db
```

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Dacă returnează un rând, ești ok
```

### Dacă extensia nu e disponibilă — imaginea Docker trebuie înlocuită:

```yaml
# docker-compose.yml — înlocuiești imaginea:
# DIN:
image: postgres:16
# ÎN:
image: pgvector/pgvector:pg16  # Imaginea oficială cu pgvector inclus
```

---

## TASK 3: Row Level Security (RLS) — Application-Level

> **Decizie**: RLS nativ PostgreSQL are overhead de setup pentru MVP. Implementăm **RLS la nivel aplicație** prin `tenantMiddleware.ts` + repository pattern cu `userId` always injected. RLS nativ PostgreSQL este planificat post-MVP.

### `tenantMiddleware.ts`:

```typescript
// Rulează DUPĂ authMiddleware pe toate rutele protejate.
// Garantează că req.user.id EXISTĂ și nu poate fi suprascris.
export const tenantGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Unauthorized — no tenant context' });
  }
  next();
};
```

### Regula din repositories — NICIODATĂ fără userId:

```typescript
// projectRepository.ts — orice query include userId în WHERE
async findById(projectId: number, userId: number) {
  return prisma.project.findFirst({
    where: { id: projectId, userId }, // userId MEREU prezent
  });
}
```

---

## TASK 4: Geospatial Service (GPS → Date Automate)

**Fișier**: `backend/src/services/geospatialService.ts`

### Stack (zero cost):

- **Reverse geocoding**: Nominatim (OpenStreetMap) — fără API key, gratuit permanent
- **Zone seismice**: `data/seismic-zones.json` — extras manual din P100-1/2013, Anexa A
- **Adâncime îngheț**: `data/frost-depth.json` — extras din NP112-2014, Anexa B
- **Reguli etaje**: `data/floor-rules.json` — combinație zonă seismică + tip sol

### Structura JSON-urilor:

```json
// data/seismic-zones.json
{
  "Cluj": { "ag": "0.10g", "Tc": 0.7 },
  "Ilfov": { "ag": "0.30g", "Tc": 1.6 },
  "Vrancea": { "ag": "0.35g", "Tc": 1.6 }
}

// data/frost-depth.json
{
  "Cluj": 80,
  "București": 90,
  "Suceava": 110,
  "Constanța": 70
}

// data/floor-rules.json — reguli deterministe (nu AI!)
{
  "0.10g": { "Pietros": 5, "Argilos": 4, "Nisipos": 3, "default": 3 },
  "0.20g": { "Pietros": 4, "Argilos": 3, "Nisipos": 2, "default": 2 },
  "0.30g": { "Pietros": 3, "Argilos": 2, "Nisipos": 1, "default": 2 },
  "0.35g": { "Pietros": 2, "Argilos": 1, "Nisipos": 1, "default": 1 }
}
```

> **Regulă critică**: Numărul de etaje și adâncimea fundației sunt date din JSON-uri, **nu din AI**. AI-ul explică DE CE există regula. Datele deterministe nu se lasă pe seama unui LLM care poate halucina.

### Flux complet:

```
POST /api/terrain/analyze-location
  Body: { lat, lng } sau { county (manual) }
  → geospatialService.reverseGeocode(lat, lng)  → county (Nominatim)
  → geospatialService.getSeismicZone(county)    → ag, Tc (JSON local)
  → geospatialService.getFrostDepth(county)     → frostDepthCm (JSON local)
  Response: { county, locality, seismicZone, frostDepthCm }
```

---

## TASK 5: Modul AI — RAG + CAG Service

> **Principiu de izolare**: `aiRoutes.ts` → `aiController.ts` → `agentOrchestrator.ts`. Folderul `services/ai/` este auto-conținut. Exportabil ca modul B2B fără să atingi restul aplicației.

### Stack AI (zero cost):

- **LLM**: Google Gemini 2.5 Pro (tier gratuit — 15 req/min, 1M tokene context)
- **Embeddings**: Gemini `text-embedding-004` (gratuit, 768 dimensiuni)
- **Vector Store**: `pgvector` în PostgreSQL existent
- **Chunking**: `pdf-parse` npm + split manual la ~800 cuvinte

### `normativeCache.ts` — CAG pentru date statice:

```typescript
// Încărcat O DATĂ la `app.listen()`, ținut în memorie pe durata sesiunii
let cache: string | null = null;

export async function loadNormativeCache(): Promise<string> {
  if (cache) return cache;

  // Doar tabelele de valori — nu tot PDF-ul
  const seismicTable = JSON.stringify(seismicZones);
  const frostTable = JSON.stringify(frostDepth);
  const floorRules = JSON.stringify(floorRulesData);
  const minRooms = `Legea 114/1996: Cameră living min 18mp, dormitor min 9mp, baie min 3mp`;

  cache = `[TABELE NORMATIVE]\n${seismicTable}\n${frostTable}\n${floorRules}\n${minRooms}`;
  return cache;
}
```

### `ragService.ts` — căutare în pgvector:

```typescript
async function searchRelevantChunks(question: string, sources: string[]): Promise<NormativeChunk[]> {
  const questionEmbedding = await embeddingService.embed(question);
  return prisma.$queryRaw`
    SELECT *, 1 - (embedding <=> ${questionEmbedding}::vector) as similarity
    FROM "NormativeChunk"
    WHERE source = ANY(${sources})
    ORDER BY similarity DESC
    LIMIT 5
  `;
}
```

### `aiController.ts` — Streaming SSE (obligatoriu pentru UX):

> Screen 3 poate dura 3-8 secunde fără streaming. Cu streaming, textul apare progresiv — UX identic cu ChatGPT, userul nu crede că s-a blocat.

```typescript
export const chatStream = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await geminiClient.generateContentStream(prompt);

  for await (const chunk of stream.stream) {
    res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
};
```

Pe frontend, `aiApi.ts` folosește `EventSource` sau `fetch` cu `ReadableStream`.

---

## TASK 6: Script Seed Normative

**Fișier**: `backend/src/scripts/seedNormatives.ts`

Rulat **o singură dată** pentru a procesa PDF-urile în chunks + embeddings în pgvector.

```typescript
import pdfParse from 'pdf-parse';
import { prisma } from '../lib/prisma';
import { embeddingService } from '../services/ai/embeddingService';

async function seedNormative(filePath: string, source: string) {
  const pdfBuffer = fs.readFileSync(filePath);
  const { text } = await pdfParse(pdfBuffer);

  const chunks = splitIntoChunks(text, 800); // 800 cuvinte per chunk

  for (const chunk of chunks) {
    const embedding = await embeddingService.embed(chunk.content);
    await prisma.normativeChunk.create({
      data: {
        source,
        chapter: chunk.title,
        content: chunk.content,
        embedding,
      }
    });
    await sleep(100); // rate limiting Gemini (15 req/min tier gratuit)
  }
  console.log(`✅ Seeded: ${source} — ${chunks.length} chunks`);
}

// Rulare:
await seedNormative('./data/normative/NP112-2014.pdf', 'NP112-2014');
await seedNormative('./data/normative/P100-1-2013.pdf', 'P100-2013');
await seedNormative('./data/normative/CR6-2013.pdf', 'CR6-2013');
```

### `package.json` — script adăugat:

```json
"scripts": {
  "seed:normatives": "ts-node src/scripts/seedNormatives.ts"
}
```

---

## TASK 7: Validare Zod — Corectă

### `screen1Schema` — cu `refine` pentru coerență lat/lng:

```typescript
export const screen1Schema = z.object({
  projectId: z.number().int().positive(),
  county: z.string().optional(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  polygonGeoJSON: z.any().nullable(),
}).refine(
  (data) => {
    // Dacă ai lat trebuie și lng și vice-versa
    if (data.lat !== null && data.lng === null) return false;
    if (data.lng !== null && data.lat === null) return false;
    return true;
  },
  { message: "Latitudinea și longitudinea trebuie introduse împreună sau deloc" }
);
```

---

## TASK 8: WizardContext — Sursa de Adevăr Frontend

> **Regula**: DB este sursa de adevăr pentru `wizardStep`. La load, frontend-ul citește din DB și sincronizează starea locală. Nu există conflict între tab-uri sau refresh.

```typescript
// frontend/src/context/WizardContext.tsx
export const WizardProvider = ({ children }: { children: ReactNode }) => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // La load (dacă există un proiect activ în curs), sincronizare cu DB
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId).then(p => {
        setCurrentStep(p.wizardStep); // DB e sursa de adevăr
      });
    }
  }, [projectId]);

  // ...
};
```

---

## TASK 9: Screen 1 — Identificare Teren

### Flux A (cu GPS — recomandabil):
1. User dă click pe hartă → `lat, lng` capturate
2. Call automat: `POST /api/terrain/analyze-location` cu `{ lat, lng }`
3. Backend → Nominatim → județ → JSON seismic → JSON frost
4. UI afișează card: *„Județ: Cluj | Zonă seismică: 0.10g | Adâncime îngheț: 80cm"*

### Flux B (fără GPS — simplificat față de planul inițial):

> **Decizie revizuită**: Leaflet.draw (polygon liber) creează conflicte cu React Leaflet și 2-3 zile de debug pentru MVP. **Înlocuit cu**: User trage un **dreptunghi simplu** pe hartă (2 click-uri, mai simplu de implementat) + introduce manual județul/localitatea.
>
> Suprafața dreptunghiului se calculează în backend cu `turf.js` și se stochează în `plotAreaSqm`. Nu se recalculează la citire.

### Convergență:
Ambele fluxuri scriu aceleași câmpuri în DB. Backend-ul este agnostic față de sursa datelor.

---

## TASK 10: Screen 2 — Caracteristici Teren

### Adăugiri față de ce există:
1. **Câmp Pantă** — slider 0-45%
2. **Câmp Orientare față de stradă** — compass selector vizual
3. **Widget AI Chat** — `AIChatBubble.tsx`:
   - Buton: *„Nu știu tipul de sol — Ajutor AI"*
   - Apelează `POST /api/ai/chat` cu streaming SSE
   - Agentul RAG citește NP 112-2014, Cap. 3 (identificare vizuală sol)
   - La final: buton *„Alege automat: Argilos"* → completează câmpul din chat

---

## TASK 11: Screen 3 — Ce ai voie să construiești

### UI cu streaming:
- Spinner + text progresiv (streaming SSE): *„Analizez zona seismică... Calculez adâncimea fundației..."*
- Rezumat vizual final cu 3 secțiuni:
  - 🏗️ **Număr maxim etaje**: din `floor-rules.json` (determinist)
  - 📏 **Adâncime minimă fundație**: din frost depth + NP112 (determinist)
  - 📖 **Explicație AI**: de ce există aceste limite (RAG din P100 + NP112)
- Buton *„Acceptă și Continuă"* → salvează `maxAllowedFloors`, `minFoundationDepthCm` în DB

---

## TASK 12: Screen 4 — Tipul de Casă

### UI:
- 4 cards cu imagine (Modern, Industrial, Clasic, Mediteranean)
- Click → modal Preview cu galerie + descriere stil
- Selector configurație: Subsol / Parter / Etaje (1, 2) / Mansardă
  - **Regulă de business**: Configurațiile care depășesc `maxAllowedFloors` (din DB) sunt `disabled` + tooltip: *„Normativele nu permit această configurație în zona ta"*
- La Finalizează → salvare în DB → redirect Faza 2 cu `projectId` în URL

---

## TASK 13: Flow Creare Proiect (revizuit complet)

```
ACUM: Wizard → console.log → nimic

DUPĂ:
1. User intră în Wizard → POST /api/projects → proiect creat cu wizardStep: 1
2. projectId stocat în WizardContext
3. Screen 1 → PATCH /api/projects/:id (lat, lng, county, seismicZone, frostDepthCm, wizardStep: 1)
4. Screen 2 → PATCH /api/projects/:id (soilType, slope, orientation, wizardStep: 2)
5. Screen 3 → PATCH /api/projects/:id (maxAllowedFloors, minFoundationDepthCm, wizardStep: 3)
6. Screen 4 → PATCH /api/projects/:id (houseStyle, config etaje, isCompleted: true, wizardStep: 4)
7. Redirect la /projects/:id/editor (Faza 2)
```

---

## API Endpoints Faza 1

```
POST   /api/projects                      Creare proiect la intrarea în Wizard
PATCH  /api/projects/:id                  Salvare progresivă (orice screen)

POST   /api/terrain/analyze-location      Screen 1 — GPS → județ + seismic + frost
POST   /api/terrain/save-screen1          Screen 1 — salvare coordonate

GET    /api/terrain/regulations/:id       Screen 3 — citire maxFloors + minFoundation

POST   /api/ai/chat                       Screen 2 — conversație RAG (streaming SSE)
GET    /api/ai/regulations-summary/:id    Screen 3 — rezumat AI per proiect (streaming SSE)
```

---

## ORDINEA DE IMPLEMENTARE (Sprint Plan — Revizuită)

```
Sprint 1 (2-3 zile):
  [x] Setup pgvector în PostgreSQL (PRIORITATE 1 — detectezi probleme devreme)
  [x] Extindere schema Prisma + migrare
  [x] JSON-uri: seismic-zones.json, frost-depth.json, floor-rules.json
  [x] geospatialService.ts (Nominatim + JSON-uri)
  [x] Endpoint POST /api/terrain/analyze-location → testat cu Bruno/Postman
  [x] Structuri goale: repositories + services (interfețe fără implementare)

Sprint 2 (2-3 zile):
  [ ] WizardContext.tsx (sursa de adevăr frontend)
  [ ] Creare proiect la intrarea în Wizard (POST /api/projects)
  [ ] Salvare progresivă Screen 1 + Screen 2
  [ ] useProjectGuard.ts — hook middleware frontend
  [ ] Extindere Step1Location.tsx — Flux A complet + Flux B (dreptunghi simplu)

Sprint 3 (3-4 zile):
  [x] seedNormatives.ts script + procesare PDF-uri normative
  [x] embeddingService.ts (Gemini text-embedding-004)
  [x] ragService.ts (similarity search pgvector)
  [x] normativeCache.ts (CAG — încărcare statică)
  [x] agentOrchestrator.ts (logica RAG+CAG combinată)
  [x] aiController.ts cu streaming SSE
  [x] AIChatBubble.tsx (widget refolosibil pe frontend)
  [x] aiRoutes.ts (adaugare express route)

Sprint 4 (2-3 zile):
  [ ] Step3Regulations.tsx (NOU — Screen 3 cu streaming)
  [ ] Step4HouseType.tsx (NOU — Screen 4 cu reguli disabled)
  [ ] Extindere Step2Terrain.tsx (pantă + orientare + AI chat)

Sprint 5 (1-2 zile):
  [x] PATCH controller sanitizat cu whitelist de câmpuri + calcul totalFloors automat
  [x] DELETE endpoint pentru proiecte (cu ownership check)
  [x] useProjectGuard — mapare completă a tuturor câmpurilor la restore
  [x] ProjectWizard — handleFinish async cu PATCH final + redirect la /dashboard/projects/:id
  [x] Skeleton loader premium în Wizard și MyProjects (înlocuit spinner)
  [x] ProjectDetail.tsx (pagina completă proiect: locație, reglementări, configurație)
  [x] MyProjects — carduri clickabile, badge status (Completat/În Progres), stagger animations
  [x] Routing nou: /dashboard/projects/:id → ProjectDetail
```

---

## DECIZII ARHITECTURALE FINALE

| Decizie | Alegere | Motivare |
|---|---|---|
| **Strategie AI** | RAG + CAG hybrid | CAG pentru normative statice (zero latență), RAG pentru date dinamice |
| **LLM** | Google Gemini 2.5 Pro | 1M tokene context (perfect CAG), tier gratuit generos |
| **Vector Store** | `pgvector` (PostgreSQL) | Zero cost, zero infra extra, deja ai PG |
| **Setup pgvector** | Sprint 1 (nu Sprint 3) | Detectezi probleme Docker devreme |
| **Flux B desenare teren** | Dreptunghi simplu (nu polygon liber) | Evită 3 zile de debug cu Leaflet.draw |
| **Reguli etaje/fundație** | JSON-uri deterministe | Nu se lasă pe seama AI-ului date critice de siguranță |
| **RLS** | Application-level (tenantMiddleware + repository) | Suficient pentru MVP; RLS PostgreSQL nativ post-MVP |
| **Streaming** | SSE (Server-Sent Events) | UX ChatGPT-like; fără WebSocket overhead |
| **Salvare Wizard** | Progresivă per screen | Userul nu pierde datele la refresh/revenire |
| **Sursa de adevăr wizardStep** | DB | Frontend sincronizează la load; nu există conflict tab-uri |
| **Calcul suprafață teren** | `turf.js` server-side, stocat în plotAreaSqm | Nu se recalculează la fiecare citire |
| **polygonGeoJSON** | Tipizat explicit în `TerrainPolygon` | Prisma returnează `unknown` pentru `Json?` — tipizarea previne erori TS |

---

## LIVRABILE FAZA 1

La finalul Fazei 1, aplicația va putea:

1. ✅ Crea un proiect și salva automat datele din fiecare screen (salvare progresivă)
2. ✅ Detecta județ, zonă seismică și adâncime îngheț din coordonate GPS (Nominatim + JSON-uri)
3. ✅ Permite trasarea unui dreptunghi pe hartă pentru teren fără GPS
4. ✅ Oferi un asistent AI care explică tipul de sol (RAG din NP112-2014, streaming)
5. ✅ Genera restricțiile de construcție per zonă (date deterministe + explicație AI prin RAG)
6. ✅ Bloca vizual opțiunile de etaje care depășesc normativele
7. ✅ Persista starea wizard-ului — userul poate reveni de unde a rămas
8. ✅ Oferi streaming SSE pentru toate răspunsurile AI (UX fluid, fără freeze)
9. ✅ Estima clasa energetică a casei (baza pentru diferențiatorul de produs)
