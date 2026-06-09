# Sumar Implementare Faza 3: Etape Construcție, Materiale & Deviz Final (Actualizat)

Acest document reflectă implementarea curentă a Fazei 3, focusată pe estimarea de costuri (BOM - Bill of Materials), gestiunea materialelor și urmărirea etapelor construcției. Datele reflectă arhitectura din codul sursă existent.

## 1. Catalogul de Materiale și Scraping
- **Seed Dinamic & Schema DB (`schema.prisma`)**: Catalogul are o reprezentare solidă prin modelul `Material`, cu suport direct pentru prețuri (`pricePerUnit`), categorii, metadate tehnice (ex: `compressiveStrength`), url-uri din magazine și un model secundar `PriceHistory` pentru a urmări evoluția.
- **RAG pe Materiale (`MaterialChunk`)**: Fișele tehnice text sunt procesate via `MaterialChunk` ca vectori, permițând AI-ului să caute și să compare tehnic specificații.
- **Mapping Semantic (AI as Data Engineer) (`materialAnalyzer.ts`)**: Prin Gemini, produsele brute din scraping sau seed sunt standardizate pe o taxonomie strictă de coduri de bază (ex. `STANDARD_BCA_25`).

## 2. Motorul BOM (Bill of Materials) (`bomService.ts`)
- **Formule Determinate**: Fără indexări de cost la m2. Calculul folosește JSON-ul cu formule (`bom-formulas.json`) unde variabilele cantitative (suprafețe extrase din plan 2D) se înmulțesc cu prețurile materialelor curente asociate codurilor din sistem.
- **Persistență în `ProjectBOM`**: La recalculare, vechiul BOM se curăță și este regenerat, stocând per etapă faza, formula (`formulaKey`), cantitatea calculată, prețul de referință și notele tehnice explicative de calcul.
- **Înlocuirea Materialelor (Overrides)**: Baza de date suportă `ProjectMaterialOverride` prin care utilizatorul poate forța un alt material pentru o formulă (ex: schimbare marcă BCA). Ruta API (`PATCH /api/bom/:projectId/material`) gestionează direct acest lucru.

## 3. Urmărirea Etapelor de Construcție (Timeline)
- **Model `ConstructionPhase`**: La inițializarea fazei 3, etapele din `construction-phases.json` sunt populate automat în baza de date cu ordinea cronologică (fundație, structură, acoperiș, etc.).
- Funcționalitate de finalizare a etapelor (API: `/api/construction/:projectId/phases/:phaseId/complete`), vizibilă în `ProjectTimeline.tsx`.

## 4. BOM Advisor (AI Consultanță și Workflow)
- **`BomPhaseProgress` DB Model**: Stocare dedicată a stadiului (faza activă de configurat, fazele completate) necesară chat-ului.
- **`useBOMAdvisorChat.ts` & UI Tracker**: Asistent AI care analizează fiecare etapă specifică (ex: Structură, Zidărie) pe rând.
- **Acțiuni Specifice**: Când AI-ul discută devizul unei faze, există suport pentru acțiunea explicită de confirmare (ruta POST `/api/bom/:projectId/phase-state/confirm`), permițând sistemului să mute utilizatorul la faza de construcție următoare.
- **Intro AI Cache-uit**: Modelul `BomIntroCache` ține ultimul discurs introductiv pentru performanță (`getBOMIntro`).

## 5. UI Faza 3
- Pagina de deviz are componenta `BOMSummary.tsx` bazată pe `recharts` pentru grafice (Pie Chart), integrată perfect cu hook-urile de preluare asincronă `useBOMData.ts`.
- Aplicația trece transparent de la finalizarea `PlanSnapshot`-ului publicat din Editor, trăgând instant valorile metrice în BOM Engine.

## 6. Limitări Cunoscute și Extinderi Viitoare (Note pentru Lucrare)

În vederea documentării obiective a stadiului platformei pentru susținere, au fost identificate următoarele limitări și decizii arhitecturale în Faza 3:

### 6.1 Formule BOM Incomplete (Limitare Implementare)
Deși motorul BOM este complet funcțional din punct de vedere arhitectural (calculează asincron cantitățile, aplică waste factors și mapează materialele curente), setul de formule matematice (`bom-formulas.json`) **nu este exhaustiv**. Categoriile precum **Finisaje Fine, hidroizolația, coroana de beton și instalațiile (sanitare/termice/electrice)** nu au fost încă transpuse în ecuații deterministe. Acestea reprezintă o limitare a implementării curente și sunt vizate strict ca extinderi viitoare pentru atingerea unui deviz 100% complet.

### 6.2 Agentul Deviz fără Surse Vectorizate (RAG Zero-Hit)
Sistemul de rute hibride înregistrează oficial agentul „deviz” (via `agentRegistry.ts`), însă momentan script-ul de populare a bazei de date nu a introdus niciun document tip `NormativeChunk` asociat acestui agent specific. Consecința practică este că, dacă un utilizator adresează o întrebare tehnică referitoare la normativele de preț sau devizare prin asistent, **sistemul RAG va returna 0 rezultate**. LLM-ul va răspunde strict pe baza cunoștințelor sale pre-antrenate (zero context normativ intern), ceea ce expune platforma la un risc teoretic de halucinare pe segmentul de devizare. Această lacună este recunoscută și va fi acoperită prin ingerarea viitoare a indicatoarelor de norme de deviz (ex. seria Ts).

### 6.3 Scraping Automat vs. Sincronizare Manuală (Pivotare Arhitecturală)
Platforma a pivotat justificat de la extragerea live prin Puppeteer (datorită mecanismelor de protecție agresive tip WAF/Cloudflare ale magazinelor de bricolaj), trecând la un proces decuplat de injecție a prețurilor. 
Totuși, trebuie precizat că, deși fișierul `scraperService.ts` există în codebase-ul aplicației ca un Proof of Concept, el este **inactiv în mediul de producție**. Sincronizarea prețurilor nu se realizează automat printr-un *cron job*, ci necesită declanșare manuală din interfața de administrare (via un buton de Sync). Această limitare trebuie menționată explicit pentru a evita discrepanța vizuală dintre existența modulului de scraping în arhitectură și lipsa execuției lui autonome.
