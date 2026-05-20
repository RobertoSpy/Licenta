# Sumar Implementare Faza 2: Editor 2D Interactiv

Acest document reflectă stadiul curent și exhaustiv al funcționalităților implementate pentru Faza 2 a aplicației Zidario — Editorul 2D Interactiv de planimetrie.

## 1. Arhitectura Editorului și State Management
- **Tehnologie de Bază:** `react-konva` (Konva.js) pentru randarea de înaltă performanță pe Canvas HTML5.
- **Managementul Stării:** Utilizare `Zustand` (`useEditorState.ts`) pentru performanță sporită și evitarea re-randărilor inutile pe care React Context le-ar fi cauzat la fiecare mișcare de mouse.
  - Gestionează lista de elemente (camere, pereți, goluri).
  - Controlează `scale`-ul și `offset`-ul pentru funcționalitățile de Pan & Zoom.

## 2. Unelte de Desen și Interacțiune (Konva Canvas)
- **Editor Canvas (`EditorCanvas.tsx`):**
  - Grid de fundal adaptiv.
  - Pan și Zoom (inclusiv suport pentru scroll/wheel).
  - **Snap to Grid / Snap to Elements:** Poziționare precisă a pereților și camerelor.
- **Calcul Suprafețe (`useRoomCalculator.ts`):**
  - Hook dedicat ce procesează poligoanele desenate.
  - Calculează automat și în timp real suprafața utilă (mp) și perimetrul fiecărei încăperi.
- **Riglă Metrică Adaptivă (`EditorRuler.tsx`):**
  - Rigle orizontale și verticale randate SVG, poziționate absolut peste Canvas.
  - Se adaptează dinamic la nivelul de zoom al utilizatorului (marchează unități de 0.5m, 1m, 2m în funcție de scară).
  - Include buton de „Fit to Screen” pentru resetarea rapidă a vizualizării.

## 3. Validarea Conformității (Legea 114/1996 + reguli suplimentare)
Validarea este complet centralizată în backend (DRY), iar UI doar afișează rezultatele.
- **Validator Determinist (`conformityService.ts`):**
  - Regula de suprafață minimă (Legea 114/1996) este evaluată server-side.
  - Emite `issues` standardizate (cod, articol, valori, sugestie).
- **Reguli Suplimentare via RAG (`conformityRulesCache.ts`):**
  - Pragurile sunt extrase automat din normativ (P118-99) pe baza chunk-urilor RAG.
  - Cache 6h pentru stabilitate, fără inventarea valorilor.
  - Exemple implementate: lățime minimă coridor/hol, lățime minimă ușă evacuare.
- **Modularitate Frontend (`useConformityCheck.ts`):**
  - Debounce 2s, trimite dimensiuni camere + uși către backend.
  - Primește `violations` și `warnings` ca listă de reguli încălcate.
- **UI Conformitate (`EditorConformityAlert.tsx`):**
  - Afișează lista de încălcări + recomandări, cu sugestii concrete.
  - SSE rămâne pentru explicații AI doar pe încălcări legale (Legea 114/1996).

## 4. Versionare și Auto-Save
- **Auto-Save (`useEditorAutoSave.ts`):** Salvează automat în fundal JSON-ul canvas-ului, asigurând că progresul utilizatorului nu este pierdut.
- **Baza de Date (`PlanSnapshot`):** Structură Prisma dedicată salvării istoricului de versiuni. Fiecare proiect are o listă liniară de snapshot-uri.
- **Manager de Versiuni (`EditorVersionHistory.tsx`):**
  - Dropdown interactiv direct în toolbar-ul editorului.
  - Afișează istoricul salvărilor.
  - **Restaurare:** Permite întoarcerea în timp la un snapshot anterior (cu un prompt de confirmare dacă există modificări nesalvate).
  - **Publishing:** Permite marcarea unei versiuni specifice ca versiune finală ("Published" - evidențiată vizual), care va fi folosită mai departe de Faza 3 (Materiale/BOM).

## 5. Raportare și Export PDF
- **Flux Client-to-Server Base64:** În loc să folosească URL-uri lungi, frontend-ul serializează Canvas-ul curent într-un PNG Base64 și îl trimite securizat prin metoda POST.
- **Serviciu Puppeteer (`exportService.ts` + `exportRoutes.ts`):**
  - **Randare Server-Side:** Rulează un browser Chrome headless pentru a genera un PDF de înaltă calitate, complet styling-uit (fără limitările funcției browser `window.print`).
  - **Layout 2 Pagini:**
    - *Pagina 1 (Copertă):* Datele proiectului (Județ, Tip Sol, Tip Casă) și tabel detaliat cu suprafața fiecărei camere.
    - *Pagina 2 (Planșa):* Imaginea hi-res a planului 2D.
- **Securitate:** Rutele de export sunt protejate de același `tenantGuard` care garantează izolarea datelor (Row-Level Security) demonstrată în Faza 1.

**Concluzie:** Faza 2 este un ecosistem tehnic complet (Desen → Validare → Salvare Istoric → Export) realizat prin decuplarea clară a stării vizuale (Konva) de logica de business (Conformitate Legea 114) și comunicarea cu serverul (AI & PDF).
