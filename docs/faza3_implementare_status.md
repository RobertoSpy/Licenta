# Status Implementare Faza 3: Etape Construcție, Materiale & Deviz Final

Acest document reflectă progresul implementării Fazei 3 din proiectul Zidario, bazat pe planul inițial.

## 1. Catalog Materiale & AI Entity Resolution (Finalizat ✅)
- **Scraping Dinamic**: S-a renunțat la JSON static în favoarea unui script hibrid (`seedMaterials.ts`) care extrage produse de pe Dedeman (sau alte surse viitoare).
- **Semantic Mapping (AI)**: Produsele reale sunt trecute printr-un prompt Gemini (`materialAnalyzer.ts`) cu reguli stricte (Schema Validation). AI-ul acționează ca un Data Engineer, mapând produsul real pe o taxonomie fixă de coduri standard din sistem (ex: `STANDARD_BCA_25`, `STANDARD_BETON_C20_25`).
- **DB Schema**: Modelele `Material` și `PriceHistory` au fost actualizate și migrate în Prisma.

## 2. BOM Engine — Calcul Deviz (Finalizat ✅)
- **Taxonomie**: Formulele de calcul au fost trecute într-un JSON standardizat (`bom-formulas.json`), fiecare vizând un cod fix asigurat de AI (ex: `STANDARD_LEMN_STRUCTURA`).
- **BOM Repository**: Funcții CRUD pentru `ProjectBOM` care permit recalcularea sau ștergerea ușoară la schimbări.
- **BOM Service**: Funcția `calculateBOM` injectează formulele extrase din fișier cu datele planului 2D (`ProjectMetrics`) evaluându-le matematic pentru a produce necesarul de materiale, adăugând un coeficient de pierderi (waste).
- **Rute API**: Rute sub `/api/bom` create și protejate.

## 3. Etapele Construcției (Finalizat ✅)
- **Model Date**: Etapele cronologice (Fundație, Structură etc.) din `construction-phases.json` generează în baza de date modele `ConstructionPhase` per proiect.
- **Service & Repositories**: Crearea etapelor automat și actualizarea stării de "finalizat" (`markPhaseCompleted`).
- **Rute API**: Rute sub `/api/construction` expuse și atașate la index.

## 3.1 BOM Advisor — Progres Etape + Confirmare (Finalizat ✅)
- **Model dedicat**: Persistență pentru progresul etapelor BOM în `BomPhaseProgress` (fără reutilizarea `ChatSummary`).
- **Tracker UI**: Step tracker vizual în header-ul chat-ului BOM, cu etapă activă și etape completate.
- **Confirmare etapă**: Buton explicit "Confirmă etapa" + suport pentru mesajul "confirm".
- **SSE Events**: `event: phase` pentru starea etapelor și `event: message` pentru stream text.

## 4. Integrare Frontend (Finalizat ✅)
- **Navigare**: Am adăugat banner-ul "Faza 3" în `ProjectDetail.tsx` pentru a face tranziția clară după Faza 2.
- **Rute și Hook-uri**: Rutele `/dashboard/projects/:id/bom` și `/dashboard/projects/:id/timeline` au fost adăugate, folosind hook-uri custom (`useBOMData`, `useConstructionData`) pentru comunicarea sigură cu API-ul.
- **Pagina de Deviz (`ProjectBOM.tsx`)**: Un tabel modern împărțit logic pe etape, preluând instant calculele din API, și însoțit de componenta `BOMSummary.tsx` cu un grafic interactiv tip Pie Chart (integrat via `recharts`).
- **Timeline-ul Interactiv (`ProjectTimeline.tsx`)**: O componentă vizuală (`ConstructionTimeline.tsx`) cu bară de progres global și acțiuni de "Marchează ca Finalizat" care apelează backend-ul pentru a updata baza de date.
- **BOM Intro Personalizat**: Mesaj de introducere generat AI cu fallback determinist și cache per proiect.

## Următorii Pași (To Do)
- [x] **Variante Alternative**: Sistemul permite interogarea și _înlocuirea manuală_ a materialelor via un Side Drawer interactiv.
- [x] **Optimizarea Bugetului (AI Zidario)**: Integrat stream SSE pentru explicarea normativelor tehnice direct în panoul de alternative.
- [ ] **Export PDF Deviz Final**: O funcție care generează devizul complet, planul și etapele într-un PDF descărcabil (ex: Puppeteer).
- [ ] **Cron Job de Prețuri**: Crearea unui cron pentru `priceService` (săptămânal) pentru a actualiza automat prețul materialelor pe Dedeman/Leroy Merlin.

_Ultima actualizare: Mai 2026 (23)_
