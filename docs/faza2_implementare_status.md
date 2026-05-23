# Sumar Implementare Faza 2: Editor 2D Interactiv (Mod Configurator)

Acest document reflectă stadiul **curent și exhaustiv** al funcționalităților implementate pentru Faza 2 a aplicației Zidario — Editorul de Plan 2D în Mod Configurator.

> **Notă arhitecturală:** Editorul nu mai este un editor liber de tip CAD. A fost înlocuit cu un **Configurator parametric** (Mod Configurator) orientat spre utilizatorii finali (proprietari), care generează planuri prin selecție de parametri, nu prin desen manual.

---

## 1. Arhitectura Editorului și State Management

- **Tehnologie de Bază:** `react-konva` (Konva.js) pentru randarea pe Canvas HTML5.
- **Managementul Stării:** `Zustand` (`useEditorState.ts`) — sursa unică de adevăr pentru tot editorul.
  - Gestionează lista de elemente (camere, uși, ferestre, pereți).
  - Controlează `scale`-ul și `offset`-ul canvas-ului (auto-centrate pe amprentă).
  - Stochează configuratorul: `houseShape`, `dimensions`, `activeRooms`, `streetOrientation`.
  - Stochează suprascrierile manuale ale utilizatorului: `addedOpenings`, `userDeletedOpenings`.
  - Suportă Undo/Redo (max 50 snapshot-uri în memorie).
  - **[NOU]** Stochează etajul activ (`activeFloor: FloorKey`) și acțiunea `switchFloor(floor, elements)` pentru comutarea între etaje.

---

## 2. Configuratorul de Plan (înlocuiește editorul liber)

Utilizatorul **nu desenează liber**. El configurează parametrii, iar sistemul generează planul.

### 2a. Motorul de Generare (`layoutPartitioner.ts`)
- Algoritm **Slice-and-Dice** (partiționare coloană-rând) care subdivide amprenta casei în camere.
- Sortează camerele după zonă: Hol → Living → Bucătărie → Dormitoare → Băi.
- Funcția `generateConfiguratorLayout(shape, dims, rooms, streetOrientation)` → lista completă de elemente `CanvasElement[]`.
- Suportă 4 forme de casă: `rectangle`, `l_shape`, `u_shape`, `t_shape`.

### 2b. Orientare Stradă și Plasare Automată a Intrărilor
- Generatorul citește `streetOrientation` (provenit din Faza 1 — wizard).
- Ușa principală (intrarea) este plasată automat pe peretele exterior care dă spre stradă:
  - `S/SE/SV` → perete de jos, `N/NE/NV` → perete de sus, `E` → perete dreapta, `V` → perete stânga.
- Ușile interioare (de trecere, 80cm) sunt generate automat pe peretele comun dintre Hol și fiecare cameră adiacentă.
- Ferestrele sunt generate automat pe toți pereții exteriori ai fiecărei camere.

### 2c. Profiluri per Stil Arhitectural
Funcția `initializeFromProject(project)` citește `houseStyle` din Faza 1 și aplică ponderi diferite:
- **Modern:** Living spațios (3.0), Hol minimalist (0.8).
- **Industrial:** Living loft (3.5), Hol tehnic (1.0).
- **Clasic:** Hol generos (1.2), compartimentare clară.
- **Mediteranean:** Living larg (3.0), Hol cu acces terasă (1.1).

### 2d. Dimensionare automată din Faza 1
- Amprenta casei este calculată din `plotAreaSqm` (suprafața terenului):
  - `targetArea = plotAreaSqm × 0.18`, limitat între 70–140 mp.
  - Raport lățime/lungime = 1.3 (proporție estetică optimă).

### 2e. Panoul de Control Stânga (`EditorRoomsPanel.tsx`)
- Selector formă casă (Dreptunghi / L / U / T).
- Câmpuri editabile pentru lățime și lungime (în metri).
- Lista tuturor camerelor disponibile cu checkbox (bifare/debifare adaugă/elimină camera din plan).
- Stare de conformitate colorată per cameră (verde/galben/roșu).
- Buton **Regenerează Planul** (recalculează totul).

### 2f. Panoul de Proprietăți Dreapta (`EditorPropertiesPanel.tsx`)
- La selectarea unei **camere**: afișează denumire, suprafață calculată, stare de conformitate legală, preset-uri de pondere dimensiune (Foarte Mică → Foarte Mare).
  - Secțiune **„Adaugă Deschideri Manual"**: butoane Sus/Jos/Stânga/Dreapta pentru adăugarea de uși și geamuri pe oricare latură a camerei selectate.
- La selectarea unei **uși sau ferestre**: afișează coordonatele și buton de ștergere.

---

## 3. Canvas și Interacțiune Vizuală

### 3a. Auto-Centrare (`EditorCanvas.tsx`)
- La orice modificare a dimensiunilor sau formei casei, canvas-ul recalculează automat scala și offset-ul pentru a centra perfect amprenta pe ecran.
- **Panning și zoom manual au fost eliminate** — canvas-ul rămâne centrat pe planul casei. Aceasta face interfața prietenoasă pentru utilizatorii finali (nu arhitecți).

### 3b. Estetică Premium
- **Background:** pattern de puncte subtile (dot-grid) în locul grilei de linii — aspect de hârtie de proiect arhitecturală modernă.
- **Culori diferențiate per tip cameră:**
  - 🟢 Dormitoare — verde deschis
  - 🟠 Living/Sufragerie — portocaliu cald
  - 🟡 Bucătărie/Cămară — galben
  - 🔵 Baie/WC — albastru deschis
  - ⬜ Hol/Coridor — gri neutru
- Camerele au `cornerRadius={6}` și umbre fine pentru un aspect premium.
- Uși și ferestre sunt **interactive** (se pot selecta cu click), cu evidențiere vizuală (contur roșu la selecție).

### 3c. Drag-to-Swap cu Snap-Back
- Utilizatorul poate **trage o cameră peste alta** pentru a le schimba pozițiile.
- Dacă eliberează camera în afara altei camere (mutare invalidă), camera **revine instant la locul ei** prin `node.getLayer()?.batchDraw()`.

### 3d. Gestionare Manuală Deschideri
- **Adăugare:** prin butoanele Sus/Jos/Stânga/Dreapta din panoul de proprietăți.
  - **Collision guard:** respinge dacă există o altă deschidere de același tip la < 20px.
  - **Count guard:** respinge dacă camera are deja 2 uși (max 2 uși per cameră).
- **Ștergere:** click pe ușă/geam → apare butonul „Șterge" în panoul de proprietăți.
  - Deschiderile auto-generate șterse sunt memorate în `userDeletedOpenings` — nu vor fi recreate la regenerare.
  - Deschiderile manuale adăugate sunt memorate în `addedOpenings` — persistă la regenerare.

> **Eliminat:** Riglele metrice (`EditorRuler.tsx`) nu mai sunt afișate — componenta există în codebase dar nu mai este montată. Canvas-ul ocupă 100% din spațiu disponibil.

---

## 4. Validarea Conformității (Legea 114/1996)

Validarea funcționează pe **două straturi paralele**:

### Strat 1 — Backend cu debounce (`useConformityCheck.ts` + `conformityService.ts`)
- La 2s după ultima modificare, se trimite un request POST la `/editor/validate-conformity`.
- Backend evaluează suprafețele utile față de minimele din Legea 114/1996.
- Returnează `violations` (erori) și `warnings` (avertismente) cu: cod, articol, valori actuale/necesare, sugestie.
- Regulile sunt alimentate prin RAG din fișierele normative locale.

### Strat 2 — Local geometric, fără request (`useConformityCheck.ts`)
Trei reguli calculate instantaneu pe frontend pe baza geometriei elementelor `CanvasElement[]`:

| Cod | Severitate | Condiție |
|-----|-----------|----------|
| `DOOR_OVERLAP` | 🔴 eroare | 2 uși cu centrele < 20px distanță |
| `TOO_MANY_DOORS` | 🟡 avertisment | Cameră cu > 2 uși adiacente |
| `NO_WINDOW` | 🟡 avertisment | Living/Dormitor fără nicio fereastră |

Rezultatele celor două straturi sunt merge-uite și afișate unitar în `EditorConformityAlert.tsx`.

### **[NOU] Panoul de Avertismente Repoziționat (`EditorConformityAlert.tsx`)**
- **Mutat** din overlay flotant peste canvas → **coloană fixă în dreapta** (între canvas și panoul de proprietăți).
- `max-height: calc(100vh - 120px)` cu `overflow-y-auto` → scroll intern când sunt multe avertismente.
- **Butonul X** este separat de butonul collapse: X ascunde panoul complet, click pe header doar pliază/deschide lista.
- Animație din dreapta (`x: 40 → 0`) în loc de jos — nu mai acoperă planul.

---

## 5. Asistentul AI Contextual (`EditorChatSidebar.tsx`)

- Sidebar animat (Framer Motion), deschis din toolbar.
- La deschidere afișează un **mesaj de bun venit predefinit** cu lista completă de acțiuni disponibile în editor.
- La fiecare mesaj al utilizatorului, trimite invizibil un context JSON care include:
  - Datele din Faza 1 (stil, orientare stradă, reglementări teren).
  - Starea curentă a planului (număr camere, suprafețe, total mp).
- Răspunde cu explicații despre normative, optimizări spațiale și Legea 114/1996.
- Streaming SSE în timp real (răspuns caracter cu caracter).

### **[NOU] Domain Guard AI Corectat (`agentOrchestrator.ts`)**
- **Problemă rezolvată:** Anterior, AI-ul refuza întrebări legitime ale proprietarilor (ex: „unde să fie pusă baia") deoarece folosea o **whitelist** de cuvinte cheie tehnice.
- **Soluție implementată:** Înlocuit cu o **blacklist** de domenii clar off-topic (rețete, politică, sport, entertainment, medicină generală, crypto). Orice întrebare legată de casă — indiferent de formulare — ajunge acum la Gemini.
- Modelul Gemini însuși redirecționează elegant întrebările complet nerele­vante, prin system prompt, fără mesaj hardcodat urt.

---

## 6. Versionare, Auto-Save și **[NOU] Suport Multi-Etaj**

### Auto-Save și Baza de Date
- **Auto-Save (`useEditorAutoSave.ts`):** Salvare automată la 30s dacă planul e modificat (`isDirty`).
  - **[NOU]** Salvează specific etajul activ (`activeFloor`) — nu suprascrie celelalte etaje.
- **Baza de Date (`PlanSnapshot`):** Structură Prisma pentru istoricul versiunilor.
  - **[NOU]** Câmp `floor String @default("parter")` adăugat + migrare aplicată în PostgreSQL.
  - **[NOU]** Index compus `(projectId, floor)` pentru queries eficiente per etaj.
  - Cleanup automat: ultimele 20 snapshot-uri **per etaj** (nu global).

### Manager de Versiuni (`EditorVersionHistory.tsx`)
- Dropdown în toolbar cu istoricul snapshot-urilor.
- **Restaurare:** Reîncarcă un snapshot anterior (cu confirmare dacă există modificări nesalvate).
- **Publishing:** Marchează o versiune ca „Publicată" — va fi folosită de Faza 3 (Materiale/BOM).

### **[NOU] Suport Complet Multi-Etaj (end-to-end)**
Implementat pe toate straturile (DB → Backend → Frontend):

**Backend (3 fișiere):**
- `editorRepository.ts` — toate query-urile filtrează pe `floor`; cleanup per etaj (20 snapshots/etaj)
- `editorService.ts` — pass-through `floor`
- `editorController.ts` — extrage `floor` din `body` (POST) și `query string` (GET)

**Frontend (4 fișiere):**
- `editorApi.ts` — `saveFloor(projectId, floor, elements)` + `loadFloor(projectId, floor)`
- `useEditorState.ts` — `activeFloor: FloorKey` în store + `switchFloor(floor, elements)` (resetează undo/redo la switch)
- `useEditorAutoSave.ts` — trimite `activeFloor` la fiecare auto-save
- `ProjectEditor.tsx` — `handleSwitchFloor`: (1) salvează etajul curent → (2) încarcă etajul nou din API → (3) apelează `switchFloor` în store

**UX comportament:**
| Acțiune | Ce se întâmplă |
|---------|---------------|
| Apăsare „Etaj 1" | Etajul curent e salvat automat, se încarcă Etaj 1 din DB |
| Prima accesare a unui etaj nou | Canvas gol — utilizatorul proiectează de la zero |
| Ctrl+S pe Etaj 1 | Salvează specific Etaj 1, nu suprascrie Parter |
| Export PNG | Numele fișierului conține etajul: `plan-etaj1-...` |

**Selectorul de etaj** apare în top bar **numai** dacă proiectul are mai mult de un nivel (citit din `projectData.upperFloorsCount`, `hasMansard`). Butonul activ devine portocaliu, spinner în timp ce se face switch.

---

## 7. Navigare și UX Generale

### **[NOU] Selector Etaj în Top Bar (`ProjectEditor.tsx`)**
- Pastile „Parter / Etaj 1 / Etaj 2 / Mansardă" în bara de sus a editorului.
- Apare **condiționat** — numai pentru proiecte cu mai mult de un nivel.
- Butonul activ marcat portocaliu; spinner animat în timp ce switch-ul e în curs.

### **[NOU] Buton „Continuă →"**
- Buton în top-right al editorului care navighează la pagina proiectului (`ProjectDetail`).
- Marchează tranziția naturală din Faza 2 (Editor) spre Faza 3 (BOM/Deviz).

---

## 8. Export

- **PNG:** Export direct din Konva (`stage.toDataURL()`) la rezoluție 2x, fără backend. **[NOU]** Numele fișierului include etajul activ.
- **PDF:** Frontend serializează canvas-ul ca PNG Base64 → POST la `/export/plan-pdf/:id` → Puppeteer generează PDF cu 2 pagini (copertă cu date proiect + planșă hi-res).
- Rutele de export sunt protejate de `tenantGuard` (Row-Level Security, același ca Faza 1).

---

## 9. Calitatea Codului — Refactorizare Tehnică

Efectuată în cadrul aceleiași sesiuni de Faza 2:

- **`useAuth.ts` extras** din `AuthContext.tsx` → fișier dedicat `context/useAuth.ts`, respectând regula ESLint `react-refresh/only-export-components` (un fișier nu trebuie să exporte atât componente cât și hook-uri).
- **`AuthContext.tsx`** exportă acum doar `AuthProvider` + `AuthContext` (context raw pentru `useAuth.ts`).
- **0 erori TypeScript** (`tsc --noEmit`) atât pe frontend cât și pe backend.
- **0 erori ESLint** (rămân 4 warnings `react-hooks/exhaustive-deps` intenționat suprimate în Step1Location și Step3Regulations — callbacks instabili din wizard).
- Fixate catch blocks (`catch {}` fără binding) în Step3Regulations, ForgotPassword, Login, Register, ResetPassword.
- Fixate tipuri `any` implicite în ProjectDetail, Step1Location (introdus `NominatimResult` interface), GenerateLayoutModal.

---

**Concluzie:** Faza 2 este un ecosistem tehnic complet (Configurare → Generare Automată → Validare Legală → Suport Multi-Etaj → Salvare Versiuni → Export) construit pe principii clare de modularitate:
- **Motorul geometric** (`layoutPartitioner.ts`) — pur, fără side effects.
- **Starea globală** (`useEditorState.ts`) — sursă unică de adevăr, acum cu `activeFloor`.
- **Validarea** (`useConformityCheck.ts`) — două straturi paralele (backend + local).
- **Persistența** (`editorRepository.ts`) — snapshot-uri per etaj cu cleanup automat.
- **UI** (componente `Editor*`) — fiecare componentă cu o singură responsabilitate.
