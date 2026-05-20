# Sumar Implementare Faza 1: Generarea și Configurarea Proiectului

Acest document reflectă stadiul curent al funcționalităților implementate pentru Faza 1 a aplicației Zidario. Această fază pune bazele arhitecturale, securitatea datelor și fluxul de achiziție a datelor inițiale (Wizard-ul de configurare).

## 1. Arhitectură Backend și Securitate
- **Stack Tehnologic:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (cu extensia `pgvector`).
- **Autentificare (Auth):** Complet funcțională.
  - Sistem bazat pe JWT (JSON Web Tokens).
  - Suport pentru Access Tokens și Refresh Tokens.
  - Rate limiting implementat pentru rutele sensibile.
- **Izolarea Datelor (Tenant Isolation):**
  - Implementat middleware-ul `tenantGuard`.
  - Acesta asigură Row-Level Security (RLS) la nivel de aplicație: un utilizator are acces exclusiv doar la proiectele sale. Previne vulnerabilitățile de tip Insecure Direct Object Reference (IDOR).
  - Validare centralizată a proprietății; elimină codul redundant din controllere.

## 2. Fluxul Utilizatorului: Wizard de Configurare (4 Pași)
Aplicația utilizează conceptul de "Database as Source of Truth". Fiecare ecran din wizard salvează progresul direct în baza de date.

- **Pasul 1: Locație Teren**
  - Salvare coordonate (Lat/Lng) și trasare poligon (GeoJSON).
  - Integrare cu API-ul Nominatim pentru reverse geocoding (determinare județ/localitate).
  - **CAG (Context Augmented Generation):** Determinare automată a zonei seismice ($a_g$) și a adâncimii de îngheț pe baza unor fișiere JSON statice (`seismic-zones.json`, `frost-depths.json`).
- **Pasul 2: Caracteristici Sol**
  - Introducerea datelor geotehnice (tip de sol, înclinație, orientare).
- **Pasul 3: Reglementări**
  - Analiza automată AI pentru POT, CUT, regim maxim de înălțime (Legea 350/2001).
- **Pasul 4: Tip Casă**
  - Specificarea stilului arhitectural (Modern, Clasic etc.) și a compartimentării (parter, etaje, mansardă).

## 3. Sistemul de Inteligență Artificială (AI & RAG)
Faza 1 aduce un sistem avansat de asistență AI pentru respectarea normativelor de construcție din România.

- **Model de Bază:** Google Gemini (`gemini-1.5-flash` pentru chat, `gemini-embedding-2` pentru vectorizare).
- **Sistem RAG (Retrieval-Augmented Generation) Hibrid:**
  - Căutare hibridă: Dense Search (Cosinus Similarity, 3072 dimensiuni) + Sparse Search (BM25 Full-text) combinat cu Reciprocal Rank Fusion (RRF k=60).
  - **Seed Normative:** Script robust cu semantic chunking avansat (filtrează cuprinsul și datele tabulare irelevante). Peste 800 de fragmente indexate.
- **Agent Orchestrator (`agentOrchestrator.ts`):**
  - Capabil să direcționeze cererea utilizatorului (Routing) către cel mai potrivit agent specializat (ex: `seismic`, `geotehnic`, `legal`, `architectural`).
  - Previne halucinațiile izoland setul de documente căutat strict la normativul relevant (ex: P100-1/2013 pentru seismic).
- **CAG Cache (`normativeCache.ts`):**
  - Datele tabulare numerice esențiale (încărcare de zăpadă, vânt etc.) sunt încărcate în memorie RAM la boot pentru acces instantaneu de către AI, evitând căutările vectoriale ineficiente pe cifre brute.
- **Rezumat Persistent Chat (`ChatSummary`):**
  - Implementat CRUD complet pentru persistența memoriei AI-ului.
  - Injectează contextul discuțiilor anterioare direct în prompt-ul sistemului, asigurând continuitate naturală între diferitele faze ale proiectului.

## 4. Frontend și Stare (State Management)
- **Framework:** React + TypeScript + Vite.
- **State Management:** `Zustand` folosit pentru gestionarea fluxului și stării globale (ex: pașii wizard-ului, panoul de chat).
- **UI/UX:**
  - Chat educațional proactiv pe fiecare ecran.
  - Componente de validare și feed-back vizual.

## 5. Reparații Recente & Stabilitate
- Rezolvată eroarea de dimensiuni vectoriale în pgvector (schimbare schema la `vector(3072)` pentru a susține modelul Google curent).
- Refactorizări multiple pe backend pentru a elimina dependența de logica inline și a securiza query-urile Prisma (`$queryRawUnsafe` parametrizat).

**Concluzie:** Faza 1 este complet finalizată, securizată, aliniată cu documentația de licență și oferă fundația solidă de date necesară pentru Faza 2 (Editorul 2D, care tocmai a primit noile feature-uri conform ultimei sesiuni).
