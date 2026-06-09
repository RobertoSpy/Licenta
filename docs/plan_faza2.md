# Plan Implementare — Faza 2: Editor 2D Interactiv — Planul Casei

> **Nivel**: Senior Software Developer
> **Arhitectura**: Monolitic Modular — `Routes → Controllers → Services → Repositories → DB (Prisma)`
> **Principiu Editor**: Editorul 2D este construit peste **Konva.js** (Canvas 2D API). Elimină dependința de Fabric.js (abandonat) și Three.js (overkill pentru 2D). Starea editorului este gestionată cu **Zustand** (fără Redux boilerplate). Planul salvat ca JSON în DB (PlanSnapshot) devine intrarea pentru Faza 3.
> **Output Faza 2**: Un plan 2D complet al parterului, cu camere denumite și dimensionate, validat față de Legea 114/1996, exportabil ca PNG/PDF de prezentare.

---

## STADIU LA INTRAREA ÎN FAZA 2

| Componentă | Status |
|---|---|
| Auth complet (JWT, Refresh, Logout) | ✅ Complet |
| Wizard 4 pași (Teren → Reglementări → Tip Casă) | ✅ Complet |
| Salvare progresivă DB (wizardStep, isCompleted) | ✅ Complet |
| PATCH sanitizat + DELETE + ownership check | ✅ Complet |
| RAG (pgvector) + CAG (normativeCache) | ✅ Complet |
| AI Chat streaming SSE (Zidario widget) | ✅ Complet |
| ProjectDetail — pagina sumară proiect | ✅ Complet |
| Editor 2D interactiv (planul casei) | ❌ TODO — **obiectivul Fazei 2** |
| BOM / Deviz / Materiale / Export PDF complet | ❌ TODO — **Faza 3** |

---

## OBIECTIVUL FAZEI 2

La finalul Fazei 2, utilizatorul poate:

1. **Deschide editorul 2D** din pagina proiectului
2. **Desena planul parterului**: camere, pereți interiori, uși, ferestre, scări
3. **Vedea suprafața fiecărei camere** calculată automat în timp real
4. **Primi validare AI** dacă camerele respectă suprafețele minime legale (Legea 114/1996)
5. **Salva automat** planul la 30 secunde + versioning (ultima 20 versiuni)
6. **Exporta planul** ca PNG sau PDF de prezentare (fără deviz — acela e Faza 3)

---

## ARHITECTURA MODULARĂ FAZA 2

```
backend/src/
├── routes/
│   └── editorRoutes.ts        🆕 NEW — save/load/publish plan 2D
│
├── controllers/
│   └── editorController.ts    🆕 NEW — CRUD plan snapshots
│
├── services/
│   ├── editorService.ts       🆕 NEW — logică snapshot + publish
│   ├── exportService.ts       🆕 NEW — PNG export + PDF simplu (doar planul)
│   └── ai/
│       └── conformityService.ts  🆕 NEW — validare plan vs. Legea 114/1996
│
└── repositories/
    └── editorRepository.ts    🆕 NEW — CRUD PlanSnapshot în DB

frontend/src/
├── pages/dashboard/
│   └── ProjectEditor.tsx      🆕 NEW — pagina editor (container principal)
│
├── components/editor/
│   ├── EditorCanvas.tsx       🆕 NEW — Stage Konva + grid + snap + zoom
│   ├── EditorToolbar.tsx      🆕 NEW — tools: select, perete, cameră, ușă, fereastră
│   ├── EditorRoomsPanel.tsx   🆕 NEW — lista camere cu suprafețe + status conformitate
│   ├── EditorPropertiesPanel.tsx 🆕 NEW — proprietăți element selectat (W/H/rotație/label)
│   ├── EditorRuler.tsx        🆕 NEW — riglă metrică (sus + stânga canvas)
│   ├── EditorConformityAlert.tsx 🆕 NEW — banner cu violări Legea 114 + explicație AI
│   └── EditorVersionHistory.tsx  🆕 NEW — dropdown cu istoricul snapshot-urilor
│
└── hooks/
    ├── useEditorState.ts      🆕 NEW — Zustand store pentru canvas state + undo/redo
    ├── useRoomCalculator.ts   🆕 NEW — calcul suprafețe utile din coordonate canvas
    ├── useEditorAutoSave.ts   🆕 NEW — debounce 30s + POST snapshot
    └── useConformityCheck.ts  🆕 NEW — hook validare plan cu debounce 2s
```

---

## SCHEMA PRISMA — Extindere Faza 2

```prisma
// Snapshoturi auto-save ale planului 2D
model PlanSnapshot {
  id          Int      @id @default(autoincrement())
  projectId   Int
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  planJSON    Json     // Starea completă Konva: { elements: [...], scale, viewport }
  version     Int      @default(1)  // auto-increment per proiect
  label       String?  // "Versiunea manuală — după ședința cu arhitectul"
  isPublished Boolean  @default(false) // true = versiunea "oficială" → input pentru Faza 3

  createdAt   DateTime @default(now())

  @@index([projectId])
}

// Extensie model Project — adăugat în model existent
// publishedSnapshotId Int?    → FK la PlanSnapshot.id (versiunea publicată)
// totalFloorAreaSqm   Float?  → calculat din plan, stocat la publish (nu recalculate)
// planStatus          String? // "draft" | "published" | "approved"
```

### Migrare:

```bash
npx prisma migrate dev --name "faza2_plan_snapshot"
```

---

## TASK 1: Canvas Setup — Konva.js + Zustand

### Instalare:

```bash
# În directorul frontend/
npm install konva react-konva zustand
```

### De ce Konva și nu alternativele:

| Library | Verdict |
|---|---|
| **Konva.js** | ✅ Canvas API nativ. Performanță optimă 1000+ elemente. Export PNG. Drag tran nativ. |
| Fabric.js | ❌ Abandonat activ (ultima versiune majoră 2020). Nu are suport React 18. |
| Three.js | ❌ Overkill — 3D library forțată în 2D. Bundle size inutil. |
| SVG (React) | ❌ Performanță slabă peste 200 elemente. Export SVG → PNG necesită librării extra. |
| Paper.js | ❌ Niciun wrapper React oficial. Greu de integrat cu state management. |

### Concepte fundamentale canvas:

```typescript
// frontend/src/hooks/useEditorState.ts

// Scara de lucru: 1 pixel canvas = 5cm real
// Exemplu: cameră 5m × 4m → 100px × 80px pe canvas
export const PIXELS_PER_METER = 20; // 20px = 1 metru real

// Grila de snap: 20px = 1m → snap la 0.5m (10px) sau 0.25m (5px)
export const GRID_SIZE_PX = 20; // 1 celulă grid = 1m real

export type ToolType = 'select' | 'room' | 'wall' | 'door' | 'window' | 'staircase';

export interface CanvasElement {
  id: string;               // uuid v4
  type: ToolType;
  x: number;                // px canvas space (colț stânga-sus)
  y: number;                // px canvas space
  width: number;            // px canvas space
  height: number;           // px canvas space
  rotation: number;         // grade (0-360)
  label?: string;           // "Dormitor 1", "Living", "Baie"
  wallThicknessCm?: number; // 25cm exterior, 12.5cm interior (default)
  metadata?: Record<string, unknown>;
}

// Conversii utilitare
export const pxToMeters = (px: number) => px / PIXELS_PER_METER;
export const metersToPx = (m: number) => m * PIXELS_PER_METER;
```

### Zustand Store — starea completă a editorului:

```typescript
// frontend/src/hooks/useEditorState.ts

interface EditorSnapshot {
  elements: CanvasElement[];
  timestamp: number;
}

interface EditorStore {
  // Canvas state
  elements: CanvasElement[];
  selectedId: string | null;
  activeTool: ToolType;
  canvasScale: number;      // zoom level (0.5 - 2.0)
  canvasOffset: { x: number; y: number }; // pan offset
  gridSize: number;
  isSnapEnabled: boolean;
  isDirty: boolean;         // modificări nesalvate față de ultimul snapshot DB

  // Undo/Redo — stack de max 50 snapshots în memorie
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];

  // Actions — toate modificările trec prin store
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  selectElement: (id: string | null) => void;
  setTool: (tool: ToolType) => void;
  setZoom: (scale: number) => void;
  toggleSnap: () => void;
  undo: () => void;
  redo: () => void;
  loadFromJSON: (json: CanvasElement[]) => void;
  markDirty: () => void;
  markClean: () => void;
}
```

> **Decizie arhitecturală**: Nu folosim `useReducer` + Context pentru editor — Zustand nu face re-render la proprietăți nesubscrise, esențial pentru un canvas cu 100+ elemente care se mișcă în timp real.

---

## TASK 2: Toolbar & Instrumente de Desenat

### Instrumente și shortcuturi:

| Tool | Key | Comportament |
|---|---|---|
| **Select** | `V` | Click → selectare. Drag → mutare. Shift+click → multi-select. |
| **Cameră** | `R` | Click + drag → dreptunghi. La release → dialog label (Living, Dormitor etc.) |
| **Perete** | `W` | Click → punct start. Click → punct end. Snap la 0°/90°/45°. |
| **Ușă** | `D` | Click pe perete existent → inserare ușă 90cm. Rotire cu R după plasare. |
| **Fereastră** | `F` | Click pe perete existent → inserare fereastră 120cm standard. |
| **Scări** | `S` | Plasare bloc predefinit 1.2m × 3m cu vizualizare bare. |
| **Delete** | `Del` / `Backspace` | Șterge elementul selectat. |
| **Undo** | `Ctrl+Z` | Revertire la starea anterioară (max 50). |
| **Redo** | `Ctrl+Y` | Re-aplicare modificare. |
| **Zoom In** | `+` / `scroll up` | Zoom in centrat pe cursor. |
| **Zoom Out** | `-` / `scroll down` | Zoom out centrat pe cursor. |
| **Fit screen** | `Ctrl+0` | Zoom + pan → tot planul vizibil în fereastra curentă. |
| **Salvează** | `Ctrl+S` | Salvare manuală snapshot în DB. |
| **Toggle Grid** | `G` | Show/hide grid vizual. |
| **Toggle Snap** | `Shift+G` | Activare/dezactivare snap-to-grid. |

### Comportamente inteligente snap:

```
SNAP-TO-GRID (implicit ON):
  Fiecare element se aliniază la grila de 10px (0.5m) la release.
  La mutare, elementul sare discret din punct în punct.

SNAP-TO-ELEMENT (implicit ON când elementul este la <15px de alt element):
  Marginile se aliniază perfect la marginile elementelor vecine.
  Previne gap-uri invizibile între camere.
  Vizualizat prin linie de ghidaj portocalie animată.

CONSTRAINT 90°:
  Tool Perete: Shift+drag → blochează la 0° sau 90°.
  Tool Cameră: implicit dreptunghiuri perfect aliniate.

REZIZE cu handles:
  Element selectat → 8 handles la colțuri și mijlocul laturilor.
  Shift+resize → proporțional (aspect ratio blocat).
  Double-click pe handle → resetare la dimensiune implicită.
```

---

## TASK 3: Grid & Riglă Metrică

### Implementare grid Konva:

```typescript
// EditorCanvas.tsx — grid desenat pe un Layer separat, în spate

const drawGrid = (layer: Konva.Layer, canvasWidth: number, canvasHeight: number) => {
  layer.destroyChildren();
  for (let x = 0; x <= canvasWidth; x += GRID_SIZE_PX) {
    layer.add(new Konva.Line({
      points: [x, 0, x, canvasHeight],
      stroke: x % (GRID_SIZE_PX * 5) === 0 ? '#e2e8f0' : '#f1f5f9', // evidențiem la 5m
      strokeWidth: x % (GRID_SIZE_PX * 5) === 0 ? 1 : 0.5,
    }));
  }
  for (let y = 0; y <= canvasHeight; y += GRID_SIZE_PX) {
    layer.add(new Konva.Line({
      points: [0, y, canvasWidth, y],
      stroke: y % (GRID_SIZE_PX * 5) === 0 ? '#e2e8f0' : '#f1f5f9',
      strokeWidth: y % (GRID_SIZE_PX * 5) === 0 ? 1 : 0.5,
    }));
  }
  layer.draw();
};
```

### Riglă metrică (EditorRuler.tsx):

```
Sus (horizontal):  0m — 1m — 2m — 3m — ... (ticks la fiecare 0.5m, label la fiecare 1m)
Stânga (vertical): 0m — 1m — 2m — 3m — ... (text rotit 90°)
Intersecție stânga-sus: buton "Fit Screen" (Ctrl+0)

La zoom: tick-urile și labelele se adaptează —
  zoom > 1.5x → afișăm ticks la 0.25m
  zoom < 0.5x → afișăm ticks la 2m
```

---

## TASK 4: Calcul Suprafețe în Timp Real

> **Principiu**: Suprafețele se calculează exclusiv din coordonatele elementelor de pe canvas. Nu există input manual de suprafață. Utilizatorul desenează, sistemul calculează.

### `useRoomCalculator.ts`:

```typescript
// frontend/src/hooks/useRoomCalculator.ts

interface RoomInfo {
  id: string;
  label: string;
  totalSqm: number;                 // suprafața brută (cu pereți incluși)
  usableSqm: number;               // suprafața utilă (fără grosimea pereților)
  widthM: number;                  // dimensiunea W în metri
  heightM: number;                 // dimensiunea H în metri (adâncimea camerei)
  conformityStatus: 'ok' | 'warning' | 'error';
  minRequiredSqm?: number;         // din Legea 114/1996
}

function useRoomCalculator(elements: CanvasElement[]): RoomInfo[] {
  return useMemo(() => {
    const rooms = elements.filter(el => el.type === 'room');
    return rooms.map(room => {
      const wallThicknessPx = metersToPx((room.wallThicknessCm ?? 25) / 100);
      const usableWidthPx = room.width - 2 * wallThicknessPx;
      const usableHeightPx = room.height - 2 * wallThicknessPx;

      const usableWidthM = Math.max(0, pxToMeters(usableWidthPx));
      const usableHeightM = Math.max(0, pxToMeters(usableHeightPx));
      const usableSqm = parseFloat((usableWidthM * usableHeightM).toFixed(2));
      const totalSqm = parseFloat((pxToMeters(room.width) * pxToMeters(room.height)).toFixed(2));

      const minRequired = MINIMUM_SURFACES[normalizeLabel(room.label)]?.min;
      const status = !minRequired
        ? 'ok'
        : usableSqm >= minRequired
          ? 'ok'
          : usableSqm >= minRequired * 0.9
            ? 'warning'
            : 'error';

      return {
        id: room.id,
        label: room.label ?? 'Cameră',
        totalSqm,
        usableSqm,
        widthM: parseFloat(pxToMeters(room.width).toFixed(2)),
        heightM: parseFloat(pxToMeters(room.height).toFixed(2)),
        conformityStatus: status,
        minRequiredSqm: minRequired,
      };
    });
  }, [elements]);
}
```

### Suprafețe minime legale (Legea 114/1996, Art. 5):

```typescript
export const MINIMUM_SURFACES: Record<string, { min: number; label: string }> = {
  living:      { min: 18,  label: 'Sufragerie / Living' },
  sufragerie:  { min: 18,  label: 'Sufragerie / Living' },
  salon:       { min: 18,  label: 'Salon' },
  dormitor1:   { min: 12,  label: 'Dormitor principal' },
  dormitor:    { min: 9,   label: 'Dormitor' },
  camera:      { min: 9,   label: 'Cameră' },
  bucatarie:   { min: 5,   label: 'Bucătărie' },
  baie:        { min: 3,   label: 'Baie' },
  hol:         { min: 4,   label: 'Hol' },
  debara:      { min: 1.5, label: 'Debara' },
};
// Normalizare label: "Dormitor 1" → "dormitor1", "Living Room" → "living"
```

---

## TASK 5: Validare Conformitate AI (Legea 114/1996)

### Flux complet:

```
1. Utilizatorul desenează / modifică canvas (debounce 2s)
2. useConformityCheck hook detectează schimbările în rooms
3. Dacă există violări (status === 'error'):
   a. Frontend afișează imediat lista deterministă (nu AI) în EditorRoomsPanel
   b. POST /api/editor/explain-conformity (SSE streaming)
      Body: { violations: [{ label, usableSqm, minRequired }] }
4. Backend: agentOrchestrator → RAG din Legea 114/1996 → explicație de ce există regula
5. EditorConformityAlert afișează textul AI progresiv (streaming text)
```

### Endpoint backend:

```typescript
// POST /api/editor/explain-conformity
// Body: { violations: ConformityViolation[] }
// Response: SSE stream

export const explainConformity = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { violations } = req.body;
  const violationsText = violations
    .map((v: ConformityViolation) =>
      `- ${v.label}: ${v.usableSqm}mp (minim legal: ${v.minRequired}mp)`
    ).join('\n');

  // agentOrchestrator → RAG din Legea114-1996
  const stream = agentOrchestrator.explainConformity(violationsText);
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
};
```

### UI — EditorConformityAlert:

```
┌──────────────────────────────────────────────────────┐
│ ⚠️  2 camere sub limita legală (Legea 114/1996)       │
│                                                        │
│  • Living: 16.2mp (minim 18mp) ← 1.8mp lipsă         │
│  • Dormitor 1: 8.5mp (minim 9mp) ← 0.5mp lipsă       │
│                                                        │
│ 🤖 Zidario explică:                                    │
│ "Legea 114/1996, Art. 5 impune suprafețe minime        │
│  pentru a asigura condiții de locuit decente.           │
│  Livingul sub 18mp este considerat impropriu..."        │
│                            [Redimensionează automat]   │
└──────────────────────────────────────────────────────┘
```

---

## TASK 6: Auto-Save & Version History

> **Problema**: Utilizatorul poate pierde munca de 2 ore dintr-un refresh. Soluția: auto-save la 30s + history.

### `useEditorAutoSave.ts`:

```typescript
export function useEditorAutoSave(projectId: number, elements: CanvasElement[], isDirty: boolean) {
  const { markClean } = useEditorState();

  useEffect(() => {
    if (!isDirty || elements.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        await api.post(`/api/editor/snapshots`, {
          projectId,
          planJSON: { elements, savedAt: Date.now() },
        });
        markClean();
        toast.success('Plan salvat automat', {
          duration: 1500,
          position: 'bottom-right',
          icon: '💾',
        });
      } catch (err) {
        toast.error('Salvare automată eșuată');
      }
    }, 30_000); // 30 secunde după ultima modificare

    return () => clearTimeout(timer);
  }, [elements, isDirty]);
}
```

### Endpoint-uri editor:

```
POST   /api/editor/snapshots              → Creare snapshot nou (auto-save sau manual)
GET    /api/editor/snapshots/:projectId   → Lista ultimele 20 snapshot-uri
GET    /api/editor/snapshots/:id          → Conținutul unui snapshot specific (pentru restore)
PATCH  /api/editor/snapshots/:id/publish  → Marchează ca versiunea "publicată" → input Faza 3
DELETE /api/editor/snapshots/:id          → Ștergere snapshot vechi (auto-cleanup)

POST   /api/editor/explain-conformity     → SSE: AI explică violările Legea 114
GET    /api/export/plan-png/:projectId    → Export canvas ca PNG (snapshot publicat)
GET    /api/export/plan-pdf/:projectId    → Export PDF prezentare (plan 2D + date proiect)
```

---

## TASK 7: Export Plan (PNG + PDF Prezentare)

> **Scopul în Faza 2**: Exportăm DOAR planul 2D ca PNG sau un PDF simplu de prezentare (titlu, plan, date tehnice). PDF-ul complet cu deviz este Faza 3.

### Export PNG — Konva nativ:

```typescript
// frontend — export direct din Stage Konva (fără backend)
const exportToPNG = () => {
  const stage = stageRef.current;
  if (!stage) return;
  const dataURL = stage.toDataURL({ pixelRatio: 2 }); // 2x pentru print quality
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `plan-parter-${projectTitle}.png`;
  link.click();
};
```

### Export PDF Prezentare — Puppeteer backend:

```
Structura PDF (2 pagini):
  Pagina 1 — Cover
    • Logo BuildWise
    • Titlul proiectului
    • Județ, Localitate
    • Data generării
    • Rezumat: Suprafață totală parterXmp, Etaje: P+1, Stil: Modern

  Pagina 2 — Planul Parterului
    • Imaginea PNG exportată din canvas (rezoluție A4)
    • Scara: 1:100 (sau adaptată la dimensiunile casei)
    • Legendă: ■ Perete exterior | □ Perete interior | ⊶ Ușă | ≡ Fereastră
    • Tabel sumar camere: Cameră | Suprafață utilă | Status conformitate
```

---

## TASK 8: UI/UX Editor — Layout Premium

### Layout general (desktop):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Proiect Nou   [V|R|W|D|F|S]  [G][⊞]  Undo|Redo   [💾 Salvat acum 2min]   │
│                                          Zoom: 100%   [PNG↓] [PDF↓]          │
├───────────┬──────────────────────────────────────────────────┬───────────────┤
│  CAMERE   │        CANVAS KONVA 2D                           │  PROPRIETĂȚI  │
│           │  ┌────────────────────────────────────────────┐  │               │
│ Living    │  │                                            │  │ Element:      │
│ 16.2mp ❌ │  │   ████████████████████████████            │  │ Living        │
│           │  │   █                          █            │  │               │
│ Dorm 1    │  │   █     Living               █            │  │ Lățime: 5.0m  │
│ 8.5mp ❌  │  │   █                          █            │  │ Adânc: 4.0m   │
│           │  │   ████████████████████████████            │  │ Sup: 16.2mp   │
│ Baie      │  │                                            │  │               │
│ 4.0mp ✅  │  │   ████████ ████████████████████            │  │ Pereți: 25cm  │
│           │  │   █ Dorm █ Baie          Hol █            │  │               │
│ Hol       │  │   █      █               ░░░ █            │  │ [Redenumește] │
│ 3.8mp ⚠️  │  │   ████████ ████████████████████            │  │ [Șterge] Del  │
│           │  │                                            │  │               │
│ ─────────│  └────────────────────────────────────────────┘  │ ─────────────│
│ Total:    │                                                   │ 🤖 Zidario   │
│ 38.5mp    │  0────────5────────10────────15m                  │ "Livingul    │
│           │  ◀──── Rulou metric ────▶                         │  tău e sub   │
└───────────┴──────────────────────────────────────────────────┴───────────────┘
```

### Animații (conform cerințelor Sprint 4):

```
Element nou (Add) → scale 0.6 → 1.0 cu spring (stiffness: 300, damping: 18)
Element șters     → scale 1.0 → 0 + fade, duration 200ms ease-out
Element selectat  → ring portocaliu cu pulse (animate-pulse Tailwind / CSS keyframes)
Element hover     → cursor move + shadow subtil pe Konva shape
Panel conformitate → slide-in de jos cu spring (y: 40px → 0, stiffness: 400)
Toast auto-save   → apare dreapta-jos, dispare 1.5s
Zoom              → smooth cu CSS transform + ease-in-out (nu bruscat)
Panel laterale    → blur backdrop pe mobile (overlay)
```

---

## ORDINEA DE IMPLEMENTARE (Sprint Plan Faza 2)

```
Sprint 1 (3-4 zile) — Canvas de bază:
  [ ] Schema Prisma PlanSnapshot + migrare
  [ ] Setup Konva + react-konva + Zustand
  [ ] EditorCanvas.tsx — Stage, grid Layer, viewport pan + zoom
  [ ] Routing: /dashboard/projects/:id/editor → ProjectEditor.tsx
  [ ] Link "Deschide Editor" din ProjectDetail.tsx

Sprint 2 (3-4 zile) — Instrumente desenat:
  [ ] Tool "Select" — click selectare, drag mutare, handles rezize
  [ ] Tool "Cameră" — drag dreptunghi + dialog label
  [ ] Tool "Perete" — linie orizontală/verticală cu snap 90°
  [ ] Tool "Ușă" — click pe perete → inserare ușă cu rotire
  [ ] Tool "Fereastră" — click pe perete → inserare fereastră
  [ ] Undo/Redo (history stack în Zustand, max 50)
  [ ] EditorRuler.tsx — riglă metrică sus și stânga
  [ ] EditorToolbar.tsx — butoane + shortcurturi tastatură

Sprint 3 (2-3 zile) — Calcul + Validare:
  [ ] useRoomCalculator.ts — suprafețe utile din canvas
  [ ] EditorRoomsPanel.tsx — lista camere cu mp + status (✅❌⚠️)
  [ ] POST /api/editor/explain-conformity (SSE)
  [ ] EditorConformityAlert.tsx — banner cu AI explicație streaming
  [ ] EditorPropertiesPanel.tsx — proprietăți element selectat

Sprint 4 (2-3 zile) — Save/Export:
  [ ] useEditorAutoSave.ts — auto-save 30s
  [ ] POST/GET /api/editor/snapshots
  [ ] EditorVersionHistory.tsx — dropdown restore versiune
  [ ] PATCH /api/editor/snapshots/:id/publish
  [ ] Export PNG (front-end, Konva nativ)
  [ ] Export PDF prezentare (Puppeteer backend)
  [ ] GET /api/export/plan-png + /plan-pdf
```

---

## API ENDPOINTS FAZA 2

```
# Snapshots / Auto-save
POST   /api/editor/snapshots                 → Salvare plan JSON
GET    /api/editor/snapshots/:projectId      → Lista ultimele 20 snapshot-uri
GET    /api/editor/snapshots/:id             → Conținut snapshot specific
PATCH  /api/editor/snapshots/:id/publish     → Setare versiune "oficială"
DELETE /api/editor/snapshots/:id             → Ștergere

# Conformitate AI
POST   /api/editor/explain-conformity        → SSE: explicație violări Legea 114

# Export
GET    /api/export/plan-png/:projectId       → PNG din canvas (snapshot publicat)
GET    /api/export/plan-pdf/:projectId       → PDF prezentare (2 pagini)
```

---

## DECIZII ARHITECTURALE FAZA 2

| Decizie | Alegere | Motivare |
|---|---|---|
| **Editor library** | Konva.js + react-konva | Canvas API nativ: performanță, export PNG, drag/resize nativ, suport touch. |
| **State management editor** | Zustand (nu Redux/Context) | Zero re-render pe proprietăți nesubscrise. Esențial pentru canvas cu 100+ elemente care se mișcă. |
| **Auto-save strategy** | Snapshot JSON complet la 30s | Diff-urile sunt complexe. JSON complet plan este sub 50KB chiar și pentru planuri mari. |
| **Snap implementation** | Calcul manual în `onDragMove` (nu librărie) | Librăriile de snap adaugă 50KB+ pentru ce facem noi în 30 de linii. |
| **Conformitate calcul** | Determinist (JS pur) + AI explicație | Suprafata sub limită = calculul e matematic, nu AI. AI explică DOAR de ce există regula din normativ. |
| **Export PNG** | Konva.toDataURL() (front-end) | Zero overhead backend. Rezoluție la 2x pentru calitate print. |
| **Export PDF plan** | Puppeteer + HTML template | 2 pagini simple. Puppeteer renderizează identic cu browser-ul. |
| **BOM / Deviz / Prețuri** | **NU în Faza 2 — Faza 3** | Separare clară: Faza 2 = planul de arhitectură. Faza 3 = devizul și bugetul. |

---

## LIVRABILE FAZA 2

La finalul Fazei 2, aplicația va putea:

1. ✅ Deschide un editor 2D interactiv cu grid metric și snap
2. ✅ Desena camere, pereți, uși, ferestre cu dimensiuni reale (scala 1:100)
3. ✅ Calcula automat suprafețele utile ale fiecărei camere
4. ✅ Valida planul față de Legea 114/1996 și afișa explicații AI (RAG)
5. ✅ Salva automat la 30 secunde + versioning ultimeor 20 snapshots
6. ✅ Exporta planul ca PNG sau PDF de prezentare (2 pagini)
7. ✅ Publica o versiune oficială a planului → intrare pentru Faza 3 (BOM)

> **Input Faza 3**: `PlanSnapshot.planJSON` (versiunea publicată) + datele din Faza 1 (dimensiuni, etaje, minFoundationDepthCm, seismicZone)
