# Sumar Implementare Faza 2: Editor 2D Interactiv (Mod Configurator)

Acest document reflectă stadiul **curent și exhaustiv** al funcționalităților implementate pentru Faza 2 a aplicației Zidario — Editorul de Plan 2D în Mod Configurator.

> **Notă arhitecturală:** Editorul combină interacțiunea de desen (react-konva) cu un **Configurator parametric** și un **Motor de Autogenerare Backend bazat pe agenți AI**, oferind utilizatorilor posibilitatea de a genera planuri prin selecție de parametri, nu doar prin desen manual.

---

## 1. Arhitectura Editorului și State Management

- **Tehnologie de Bază:** `react-konva` (Konva.js) pentru randarea pe Canvas HTML5.
- **Managementul Stării:** `Zustand` (`useEditorState.ts`) — sursa unică de adevăr pentru tot editorul.
  - Gestionează lista de elemente (camere, uși, ferestre, pereți).
  - Controlează `scale`-ul și `offset`-ul canvas-ului (auto-centrate pe amprentă).
  - Stochează configuratorul: `houseShape`, `dimensions`, `activeRooms`, `streetOrientation`.
  - Stochează suprascrierile manuale ale utilizatorului: `addedOpenings`, `userDeletedOpenings`.
  - Suportă Undo/Redo (max 50 snapshot-uri în memorie).
  - Stochează etajul activ (`activeFloor: FloorKey`) și acțiunea `switchFloor(floor, elements)` pentru comutarea între etaje.

---

## 2. Configuratorul de Plan și Autogenerarea

Sistemul permite autogenerarea planului pe baza unor reguli clare și a stilului arhitectural ales. Arhitectura implică o colaborare clară între LLM-uri și algoritmi geometrici determiniști.

### 2a. Fluxul de Generare cu Agenți AI (POST `/api/editor/generate-layout`)

Procesul de generare este structurat în 3 pași clari:
1. **AgentOrchestrator.getLayoutConstraints(projectId):** Activează agentul `legal_locuire`, care folosește RAG (similarity search pe NP057-2002 și Legea 114) și tabelele statice din CAG (normativeCache). Gemini generează un document strict validat cu Zod (**LayoutConstraints JSON**) care definește contractul de generare:
   ```typescript
   export const LayoutConstraintsSchema = z.object({
     minSurfaces: z.record(z.string(), z.number()),   // ex: { living: 18, baie: 3.5 }
     minWidths: z.record(z.string(), z.number()),     // ex: { hol: 1.2 }
     maxAspectRatios: z.record(z.string(), z.number()).optional(),
     zoningRules: z.object({
       streetFacing: z.array(z.string()).optional(),
       backOnly: z.array(z.string()).optional(),
       mustHaveExteriorWall: z.array(z.string()).optional()
     }).optional(),
     generatedBy: z.literal('agent_legal_locuire'),
     normativeSources: z.array(z.string())            // asigură trasabilitatea
   });
   ```
   > **Validare strictă:** Acest JSON trece obligatoriu prin validarea Zod (`LayoutConstraintsSchema.parse()`) înainte de a ajunge la algoritm. Dacă AI-ul halucinează structura, backend-ul respinge payload-ul pentru a proteja integritatea geometrică.
2. **LayoutGeneratorService.generate(params, constraints):** Primește constrângerile legale de la pasul 1. Utilizează algoritmul **Squarified Treemap** respectând `minSurfaces`, iar un **Constraint Solver** garantează respectarea `minWidths`. 
3. **Response:** Returnează lista de elemente geometrice (`CanvasElement[]`) și o copie a `constraintsUsed` (pentru transparență decizională).

### 2b. Separarea Clară: Estetică vs. Reguli Normative
O decizie arhitecturală fundamentală a fost separarea esteticii de regulile legale, pentru a demonstra trasabilitatea normativelor:
- **`house-styles.json`**: Conține EXCLUSIV preferințe estetice și proporții stilistice (ex. *Living generos, hol minimalist*). Aici există doar "ponderi", nicio valoare legală (marcat clar prin câmpul `_note`).
- **`conformity-rules.json`**: Este derivat direct din normativ (NP057-2002 și Legea 114). Aceasta este "Single Source of Truth" pentru validare și constrângeri și conține câmpurile `_source` și `_extractedAt` la fiecare regulă, asigurând că nicio valoare nu este inventată.

### 2c. Orientare Stradă și Plasare Automată a Intrărilor
- Generatorul ține cont de orientarea străzii configurată (N/S/E/V).
- Ușa principală (intrarea) este plasată automat pe peretele exterior care dă spre stradă.
- Ușile interioare și ferestrele sunt generate automat pe baza regulilor de zonare din LayoutConstraints.

---

## 3. Canvas și Interacțiune Vizuală

### 3a. Auto-Centrare (`EditorCanvas.tsx`)
- La orice modificare, canvas-ul recalculează automat scala și offset-ul pentru a centra perfect amprenta pe ecran.
- **Panning și zoom manual au fost eliminate** — canvas-ul rămâne mereu centrat pe planul casei.

### 3b. Estetică Premium
- **Background:** pattern de puncte subtile (dot-grid).
- **Culori diferențiate per tip cameră:** Dormitoare (verde), Living (portocaliu), Băi (albastru), Holuri (gri).
- Camerele au `cornerRadius={6}` și umbre fine.
- Uși și ferestre sunt **interactive** (se pot selecta cu click).

### 3c. Gestionare Manuală Deschideri și Snap-Back
- Utilizatorul poate trage o cameră peste alta pentru swap.
- Deschiderile pot fi adăugate din meniu, limitate prin **collision guard** (minim 20px distanță între uși/ferestre).

---

## 4. Validarea Conformității (Legea 114/1996)

Validarea funcționează pe **două straturi paralele**:

### Strat 1 — Backend cu debounce (`useConformityCheck.ts` + `conformityService.ts`)
- La 2s după modificare, se trimite request POST la `/api/editor/validate-conformity`.
- **Single Source of Truth Deterministic:** Validarea citește exclusiv `conformity-rules.json`. RAG-ul (baza de date `pgvector`) NU este interogat la fiecare request de validare pentru a evita o latență inacceptabilă (1-3s).
- **Explicațiile Juridice RAG:** Doar ATUNCI când se încalcă o regulă deterministă, UI-ul se conectează prin SSE la `/api/editor/explain-conformity`, unde RAG-ul (din `pgvector`) este utilizat de LLM pentru a aduce contextul legal și a explica *de ce* este necesară acea dimensiune conform NP057.

### Strat 2 — Local geometric, fără request (`useConformityCheck.ts`)
- `DOOR_OVERLAP` (eroare): 2 uși cu centrele < 20px distanță.
- `TOO_MANY_DOORS` (avertisment): Cameră cu > 2 uși adiacente.
- `NO_WINDOW` (avertisment): Living/Dormitor fără fereastră exterioară.

### Întrebări Frecvente (Arhitectură / Comisie)
- **De unde vin valorile din conformity-rules.json?** 
  Sunt extrase și derivate exclusiv din NP057-2002 și Legea 114/1996. Fiecare regulă are câmpul explicit `_source` care citează Articolul și Tabelul sursă.
- **De ce nu citiți direct din pgvector la fiecare validare?** 
  Latența și costurile ar fi prohibitive. Separarea este deliberată: matematica și decizia binară (conform/neconform) stau în JSON (zero latență), iar textul/normativul complet stă în pgvector și este apelat doar pentru *explicații contextuale*.
- **Agenții AI participă la generarea planului?** 
  Da, exact la început (pasul 1). Un singur apel AI procesează baza normativă și scoate un contract (LayoutConstraints). Algoritmul aplică acest contract mecanic. Estetica și normativele nu se contaminează reciproc.
- **Cum calculați aria ferestrelor din planul 2D pentru normele de însorire (Art.3.4.E)?** 
  Aplicația rulează pe plan (X, Y). Am presupus o înălțime standard a ferestrei de 1.5m (`WINDOW_STANDARD_HEIGHT_M = 1.5`), conform practicilor rezidențiale uzuale. Lățimea se ia din plan. Raportul vitrat/pardoseală este calculat strict geometric în backend, trecând de minimul legal de 1/8.
- **Cum se validează înălțimea minimă a tavanului din NP057 dacă aplicația e 2D?** 
  Înălțimea camerei nu este desenabilă în plan, așa că utilizăm un modul de standarde (`buildingStandards.ts`) care fixează `2.7m` pentru parter/etaj (standardul rezidențial actual) și `1.9m` pentru subsol. Ambele depășesc sau respectă constrângerile legale (2.00m, respectiv 1.90m conform Art.3.2.A.4.b), așa că validarea trece automat transparent.
- **Ce se întâmplă dacă AI-ul sugerează inițial o dimensiune prea mică pentru o cameră (sub normă)?**
  Validare post-generare deterministă: Imediat după ce `suggestRoomProgram` parsează JSON-ul, trece fiecare cameră prin `conformity-rules.json`. Dacă găsește un minim nesatisfăcut (ex: dormitor de 7mp propus, minimul legal 12mp), sistemul suprascrie valoarea `minSqm` automat la 12mp înainte s-o trimită mai departe. Se evită astfel paradoxul în care generatorul trimite valori pe care validatorul le-ar respinge ulterior.
- **Cum este pregătit sistemul pentru Faza 3 (Audit Energetic)?**
  Arhitectura Single Source of Truth are deja înregistrat un slot dormant pentru agentul `energetic` (`normative-registry.ts`) care va citi din MC001-2022. Adițional, la cererile către RAG, am adăugat disclaimere explicite de "status normativ" (ex: "NP057 este în proces de revizuire tehnică conform MDLPA"), instruind astfel AI-ul să informeze corect clientul pe probleme legislative temporare.

---

## 5. Asistentul AI Contextual (`EditorChatSidebar.tsx`)
- La fiecare mesaj, trimite un context invizibil cu datele proiectului și starea curentă a planului.
- **Domain Guard AI Corectat (`agentOrchestrator.ts`):** Folosește o **blacklist** inteligentă de domenii off-topic (politică, medical, etc.) permițând proprietarilor să pună orice întrebare practică legată de locuință.

---

## 6. Versionare, Auto-Save și Suport Multi-Etaj
- **Auto-Save (`useEditorAutoSave.ts`):** Salvare automată la 30s.
- **Baza de Date (`PlanSnapshot`):** Structură Prisma ce conține `floor String @default("parter")`.
- **Manager de Versiuni (`EditorVersionHistory.tsx`):** Istoric și restore.
- **Suport Multi-Etaj:** Frontend-ul expune un selector "Parter/Etaj/Mansardă". 

---

## 7. Export
- **PNG:** Export rapid din Konva.
- **PDF de Prezentare:** Endpoint `/api/export/plan-pdf/:projectId` via Puppeteer pentru a formata un fișier complet de audit.
