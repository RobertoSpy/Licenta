# Sumar Implementare Faza 2: Editor 2D Interactiv și Configurator Parametric (Actualizat)

Acest document reflectă arhitectura și stadiul complet al Fazei 2, bazat strict pe codul sursă existent în implementare.

## 1. Arhitectura UI și State Management
- **Tehnologie:** `react-konva` (Canvas HTML5).
- **Zustand (`useEditorState.ts`)**: Store central care gestionează:
  - Elementele geometrice 2D (camere, pereți, deschideri).
  - Scalarea și offset-ul auto-centrate (panning și zoom manual au fost dezactivate în favoarea auto-centrării pe amprentă).
  - Suport Undo/Redo (istoric de snapshot-uri locale).
  - Gestionare multi-etaj (`activeFloor` cu valori mapate pe structura DB "parter", "etaj1", "mansarda").

## 2. Motorul de Autogenerare Layout (`api/editor/generate-layout`)
Un flux hibrid AI-Algoritmic bazat pe decuplare completă între estetică și legislație.
1. **Agentul AI (AgentOrchestrator)**: Este apelat agentul `legal_locuire`, care, interogând RAG și baza de date, produce un obiect de tip `LayoutConstraintsSchema` (validat cu `zod`). Acesta dictează suprafețe minime (`minSurfaces`), lățimi minime (`minWidths`) și reguli de zonare.
2. **Generare Deterministă (`LayoutGeneratorService` / `treemapPartitioner.ts`)**: Backend-ul primește schema de constrângeri și o aplică folosind algoritmi geometrici (Squarified Treemap). Astfel, AI-ul dă regulile, matematica desenează planul.
3. **Decuplare Reguli vs. Estetică**:
   - `house-styles.json`: Controlează exclusiv estetica și proporțiile relative (ponderea camerelor), fără putere legală.
   - `conformity-rules.json`: Sursa absolută (Single Source of Truth) de validare (extrase din Legea 114, NP057-2002), citată per regulă (`_source`).
4. **Bug Rezolvat (Contradicția de Validare)**: Anterior, funcția `suggestRoomProgram` nu injecta `conformity-rules.json` în promptul AI. Exista riscul ca AI-ul să propună o cameră ilegal de mică (ex. 7mp), care era fie respinsă de validator ulterior, fie suprascrisă forțat de backend, riscând să depășească bugetul total de metri pătrați. Soluția curentă implementată este **injectarea minimelelor din `conformity-rules.json` direct în prompt-ul AI-ului** (în `roomProgramPrompt.ts`), asigurând astfel că AI-ul are cunoștință de pragurile legale *înainte* de a genera dimensiunile camerelor, eliminând contradicția.


## 3. Sistem de Validare Conformitate
Validarea normativelor rulează pe 2 niveluri complementare:
- **Validare Rapidă Locală (`useConformityCheck.ts`)**: Frontend-ul identifică imediat erori geometrice de bază (suprapuneri `DOOR_OVERLAP`, lipsă ferestre exterioare `NO_WINDOW`).
- **Validare Backend (`conformityService.ts`)**: După un debounce scurt, se face request către server care validează tot planul exclusiv prin `conformity-rules.json`. RAG-ul NU este folosit aici pentru rapiditate deterministă.
- **Explicații RAG (SSE)**: RAG-ul din `pgvector` este apelat prin SSE (`/api/editor/explain-conformity`) doar atunci când există o eroare de conformitate, pentru a explica utilizatorului *de ce* este greșită propunerea și care este cadrul legal.

## 4. Funcționalități Editare și Canvas
- Diferențiere vizuală camere prin culori cu colțuri rotunjite, pattern background dot-grid premium.
- Gestionare dinamică a deschiderilor (Uși/Ferestre) cu sistem de coliziuni (minim 20px spațiu între goluri).
- Ușa principală plasată automat prin corelarea la `streetOrientation` setată în Faza 1.

## 5. Salvare și Versionare (`PlanSnapshot`)
- **Auto-Save (`useEditorAutoSave.ts`)**: Se trimit asincron stările planului (`planJSON`).
- **Modelul DB `PlanSnapshot`**: Memorează starea exactă a Konva (camere, scale, viewport), per etaj (`floor`), având suport pentru incrementare versiuni (`version`). Proiectul păstrează pointerul final în `publishedSnapshotId` la export.

## 6. Export și Audit (Faza 2 -> Faza 3)
- Endpoint-ul `/api/export/plan-pdf/:projectId` folosește motor de Headless (ex: Puppeteer) pentru a extrage planul aprobat.
- Planul se publică și modifică `planStatus`, pregătind trecerea la calculul suprafețelor (`totalFloorAreaSqm`) și materialelor în Faza 3.
