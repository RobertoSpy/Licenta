# Documentație Faza 4: Marketplace, Ofertare, Admin și Market Intelligence

În această fază a fost finalizată transformarea aplicației dintr-un simplu configurator/simulator într-un **Marketplace B2B2C complet funcțional**. Platforma conectează cererea (clienții cu planurile 2D și Devizele BOM) cu oferta (firmele de construcții), adăugând în același timp capabilități complexe de administrare și inteligență de piață.

---

## 1. Modulul Constructor (Contractor Module)

Constructorii beneficiază de un ecosistem separat față de utilizatorul normal.
- **Tipizare prin Roluri:** Am folosit un `enum UserRole { CLIENT, CONTRACTOR, ADMIN }` pentru a rula logica pe bază de rol.
- **ContractorProfile:** O entitate de bază de date (one-to-one cu User) care stochează detaliile specifice firmei B2B: numele firmei, CUI, raza de operare (`coverageRadius`), județul principal și specializările (`specializations`).
- **Validare KYC:** Fiecare constructor are un flag `isVerified` care trebuie activat de Admin, un mod nativ de a filtra firmele legitime în sistem pentru a preveni fraudele.
- **Dashboard Dedicat:** Prin interceptarea rolului pe frontend (ex: în `MyProjects.tsx`), am construit `ContractorProjectsView`. Când un constructor accesează "Proiectele Mele", interfața se schimbă radical, arătându-i un CRM de lead-uri:
  - **Cereri în Așteptare:** Unde clientul i-a cerut o ofertă pe baza devizului.
  - **Proiecte Câștigate:** Contractele unde clientul a acceptat prețul (`QuoteStatus.ACCEPTED`).

---

## 2. Modulul de Ofertare (Quotes & Bidding)

Acesta reprezintă inima Fazei 4 — transferul proiectului calculat către execuția fizică.

- **Fluxul de cerere:** Un client cu BOM-ul generat (Faza 3) poate lansa cereri de ofertă către baza de date de constructori folosind API-ul din `quoteApi.ts` (`/quotes/request`).
- **Ciclul de viață al unei oferte (QuoteStatus):**
  - `PENDING`: Ofertă cerută de client, în așteptarea completării de către constructor.
  - `SENT`: Constructorul a adăugat prețul și devizul său (sau acceptă BOM-ul).
  - `NEGOTIATING`: Se pot trimite mesaje pe marginea devizului.
  - `ACCEPTED / REJECTED`: Decizia finală a clientului.
- **Variații de BOM (`bomVariations`):** Arhitectura permite ca o ofertă (Quote) să conțină o structură JSON prin care constructorul spune: *"Accept devizul, dar la fundație folosesc BCA în loc de cărămidă"*, recalculând on-the-fly cantitățile.

---

## 3. Market Intelligence (Analiza Pieței)

Comisia de licență apreciază enorm raportarea la contextul economic real. De aceea, am implementat un modul inteligent de prognoză a costurilor construcțiilor.

- **Indici Macro-Economici (INSSE):** Am creat entitatea `MarketIndexPoint` care stochează serii de timp istorice referitoare la indicele de cost în construcții (CNS107D). Datele sunt "seed-uite" dintr-un script (`seedMarketData.ts`).
- **Inteligență Artificială de Prognoză (MarketForecastCache):** Sistemul citește toți parametrii de inflație, prețurile actuale din Dedeman/Leroy (via scraping) și face o interogare complexă către **Gemini 1.5 Pro / 2.5 Pro**. Acesta returnează previziunea pe anul curent, ce se cache-uiește automat ca răspuns JSON pentru a nu supraîncărca API-urile Google la fiecare request.

---

## 4. Modulul de Administrare (Admin Hub)

> [!IMPORTANT]
> Un Marketplace are nevoie de moderație și control centralizat pentru a evita haosul pe planșele de cotații și prețuri false la materiale.

- **Control Central:** Doar utilizatorii cu `role: ADMIN` pot interacționa cu baza de backend pentru modificări globale. Acest lucru este asigurat prin JWT-ul interceptat și un middleware de validare a rolului.
- **Catalogul de Materiale:** Punctul cheie se află în gestionarea materialelor (`AdminMaterials.tsx`). Adminul poate face override la `pricePerUnit`, modifica coeficienții normativi și valida `chunk`-urile pentru Agentul Materiale (RAG).
- **Aprobarea Constructorilor:** Constructorii preluați din scriptul de seed (cum este `seedContractors.ts` cu Ion Constructorescu) se asociază aici, iar admin-ul îi poate suspenda prin comutarea flag-ului `isActive`.

---

> [!TIP]
> **Ce trebuie menționat la susținerea licenței referitor la Faza 4:**
> Arhitectura B2B2C oferă un "single source of truth" (o singură sursă de adevăr). Clientul vede proiectul cum îl face, iar Constructorul vede același proiect standardizat. Eliminând PDF-urile aruncate pe Whatsapp, aplicația oprește pierderea informațiilor și oprește umflarea prețurilor (sau *„țepele”* despre care am discutat pe pagina de Landing).
