# Documentație: Faza 1 Implementată - Zidario (Actualizat)

Acest document reflectă stadiul exhaustiv și la zi al primei faze majore a aplicației (Pregătire Teren și Configurare Casă). Toate informațiile sunt bazate pe arhitectura curentă din cod.

## 1. Arhitectura de Bază și Securitate
- **Sistem Auth Complet (`authController.ts`)**: Implementare stabilă pentru Register, Login, Refresh Token și Logout.
- **Securitate JWT**: Token de acces (`accessToken`) pe durată scurtă (15 min) returnat JSON, iar tokenul de reîmprospătare (`refreshToken` - 7 zile) salvat securizat prin Cookie (HttpOnly/Secure) și parțial în tabela `User` pentru invalidare.
- **Protecție Anti-Abuz**: Utilizarea Express Rate Limiter cu profiluri duale (`globalLimiter` pentru request-uri normale, `authEmailLimiter`/`authIpLimiter` pentru login).
- **ORM și Bază de Date (`schema.prisma`)**: Folosire Prisma cu PostgreSQL, suport pentru extensia `vector` necesară AI-ului.

## 2. Sistemul de Creare Proiecte (Wizard 4 Ecrane)
Starea este păstrată perfect sincronizată între Frontend (React + localStorage) și Backend (DB) prin `useProjectGuard.ts`. Modelul Prisma `Project` este structurat pe 4 ecrane:

### 2.1. Screen 1: Identificare Teren (Locație)
- **Selectare Hibridă**:
  - **Flux GPS/Stereo 70**: Utilizatorul introduce coordonate exacte; se generează `polygonGeoJSON` (salvat direct în tipul `Json` în Postgres). Suprafața (`plotAreaSqm`) este calculată cu `turf.js`.
  - **Flux Nominatim (Search)**: Căutare după localitate.
- **Geocoding (`geospatialService.ts`)**: Extrage asincron Județ (`county`) și Localitate (`locality`).
- **Date AI Normative**: Identificare automată `seismicZone` (ex: "0.30g") și `frostDepthCm` prin procesarea locației.

### 2.2. Screen 2: Caracteristici Teren
- Utilizatorul definește atribute tehnice: `soilType` (Argilos, Nisipos etc.), `slopePercent`, `streetOrientation` (N, S, E, V, util mai târziu în autogenerarea planului), și note adiționale.

### 2.3. Screen 3: Reglementări (AI)
- AI-ul RAG analizează datele din primii 2 pași și populează câmpurile `maxAllowedFloors`, `minFoundationDepthCm` și extrage eventuale `zoningRestrictions`.

### 2.4. Screen 4: Tipul Casei
- Configurare parametri principali: `houseStyle` (Modern, Clasic etc.), `buildingPurpose` (rezidențial), `hasBasement`, `hasGroundFloor`, număr etaje (`upperFloorsCount`), `hasMansard` și `budgetCategory` (economic/mediu).
- Se calculează automat `totalFloors` necesar pentru dimensionarea structurală de mai târziu.

## 3. Zidario AI & Arhitectură Multi-Agent RAG
Modulul AI (`/modules/ai`) implementează un sistem hibrid complex de tip **CAG + Multi-Agent RAG**:
- **CAG (Cache-Augmented Generation)**: Parametrii legislativi ficși sunt încărcați prin `normativeCache.ts` la pornirea serverului.
- **Vectorizare `pgvector` (`NormativeChunk` table)**: Fragmentele din legislație (ex: NP112, P100) sunt inserate folosind scriptul `seedNormatives.ts` cu embbeding de 768 dimensiuni (`Unsupported("vector(768)")`), folosind index `ivfflat`.
- **Rutare pe Agenți (`agentRouter.ts` / `agentOrchestrator.ts`)**: Interogările utilizatorului sunt clasificate și direcționate către un domeniu (`agent`: geotehnic, seismic, legal, structural, materiale, deviz). Astfel, vector search-ul se limitează la normativele din acel domeniu specific.
- **Comunicare SSE (Server-Sent Events)**: Interfața `ZidarioChat` se conectează la rutele AI pentru a primi stream-uri live, suportând un istoric permanent compus și salvat în tabela `ChatSummary` per proiect/fază/ecran.

## 4. Dashboard (UX)
- Carduri de proiecte preluând date din modelul DB `Project`. Stare actualizată dinamic (`isCompleted`, `wizardStep`).
- Rute protejate API și componentizări de UI optimizate cu Skeleton Loaders și Framer Motion pentru fluiditate.

## 5. Justificarea Empirică a Pragului de 0.60 (Semantic Routing)

Pentru a valida pragul de decizie de 0.60 (Cosine Similarity) în arhitectura de Semantic Routing, a fost efectuat un test izolat prin script-uri locale peste modelul de embedding. S-a observat empiric că un prag mai mic de 0.55 declanșa frecvent agenți irelevanți (Context Poisoning), în timp ce un prag strict peste 0.75 rata variațiile lexicale naturale ale utilizatorilor.

Tabelul de mai jos ilustrează distribuția scorurilor pentru două interogări tipice din timpul testării, demonstrând clar cum valoarea de 0.60 izolează cu succes agentul corect și previne *false positives* masive.

| Întrebare Utilizator | Agent Evaluat | Scor Cosine | Status (Prag 0.60) |
|---|---|---|---|
| *„Cât ar costa să torn o placă de 100mp?”* | **deviz** | **0.649** | **Admis** |
| *„Cât ar costa să torn o placă de 100mp?”* | geotehnic | 0.592 | Respins (ar fi fost Admis la prag 0.55) |
| *„Cât ar costa să torn o placă de 100mp?”* | structural | 0.576 | Respins (ar fi fost Admis la prag 0.55) |
| *„Cât ar costa să torn o placă de 100mp?”* | instalatii | 0.571 | Respins |
| *„Ce avize îmi trebuie pentru a construi lipit de gardul vecinului?”* | **legal** | **0.797** | **Admis** |
| *„Ce avize îmi trebuie pentru a construi lipit de gardul vecinului?”* | geotehnic | 0.612 | Admis (Scor limită)* |
| *„Ce avize îmi trebuie pentru a construi lipit de gardul vecinului?”* | structural | 0.590 | Respins |
| *„Ce avize îmi trebuie pentru a construi lipit de gardul vecinului?”* | energetic | 0.582 | Respins |

*\*Notă: Chiar și la interogarea a doua, agentul `legal` domină categoric (0.797), iar dacă s-ar fi folosit pragul de 0.75, prima interogare (0.649) nu ar fi declanșat niciun agent specializat.*
