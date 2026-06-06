# Audit Fază BOM — Rezumat executiv

**Sumar:**
- Am revizuit datele și codul legat de faza BOM (Bill Of Materials).
- Constatări principale: formule parametrică documentată (`backend/src/data/bom-formulas.json`), catalog inițial de materiale seed (`backend/src/scripts/seedBaselineMaterials.ts`) cu prețuri estimative, și funcționalități AI care explică și validează materiale dar NU calculează cantități.

**Ce am găsit (relevante pentru comisie):**
- `backend/src/data/bom-formulas.json`: set complet de formule deterministe pentru fiecare element constructiv și listă explicită de normative citate.
- `backend/src/scripts/seedBaselineMaterials.ts`: catalog baseline de materiale cu `pricePerUnit` marcat "estimativ" și linkuri comerciale; datele sunt seed/mock pentru start.
- Endpoint-urile AI (ex.: `POST /api/ai/explain-material`, `POST /api/ai/validate-override`, `POST /api/ai/chat`, `POST /api/ai/suggest-rooms`) în `backend/src/modules/ai/` — AI folosește RAG (indexare normative din `backend/docsAI/`) și Google Gemini (`GEMINI_API_KEY`) pentru explicații și verificări.
- `backend/src/scripts/seedNormatives.ts` + `backend/src/modules/ai/services/ragService.ts`: pipeline care indexează normative (PDF/MD) în fragmente, generează embeddings și returnează chunk-uri citate în răspunsurile AI.
- Documentație de proiect (`docs/plan_faza3.md`) menționează fișiere planificate pentru BOM (ex: `bomService.ts`, `bomRoutes.ts`, `ProjectBOM.tsx`) dar implementările concrete pentru motorul de calcul BOM (evaluare formule, salvare `ProjectBOM`) nu sunt prezente în codul sursă.
 - Implementarea BOM există în cod: `backend/src/modules/bom/bomService.ts` evaluează formule din `bom-formulas.json`, selectează materiale (folosind `materialSelector.ts`) și păstrează `ProjectBOM` în baza de date; mai există `bomRoutes.ts`, `bomController.ts` și `bomRepository.ts` pentru expunere și persistență.

**Observații utile pentru comisie (posibile întrebări/critici):**
- Transparenta și reproducibilitate: formulele sunt documentate clar în `bom-formulas.json`, dar motorul care le evaluează (calcul engine) pare proiectat în documentație și lipsește în implementare — imposibil de verificat reproducerea calculului automat.
- Originea prețurilor: `seedBaselineMaterials.ts` conține prețuri estimative și linkuri; nu există dovadă că prețurile sunt actualizate automat sau că provin dintr-o sursă autorizată (scraping programat, API retailer, istoric de prețuri).
- Mock / Seed: materialele sunt deocamdată „mockup/seed” — orice deviz prezentat public trebuie marcat clar ca estimativ și cu data ultimei actualizări.
- Rolul AI: AI este folosit pentru explicare, sumarizare și validare normativă (RAG). Nu este folosit pentru calculul cantităților (documentație + cod confirmă acest lucru). Riscuri: depinde de completitudinea indexului normativ; dacă `docsAI/` nu conține toate normativele relevante, AI poate returna „⚠️ Atenție” sau răspuns incomplet.
- Dependința de model extern: folosirea Google Gemini (cheie în env) impune documentare a politicii de acces, cost și riscuri (rate limits, downtime). Comisia poate cere justificare GDPR/etichă pentru date proiectului trimise către API terț.
- Justificarea coeficienților: wastePercent și coeficienți (ex: 1.3 pentru acoperiș, 15kg/mc armătură) au note normative, dar comisia poate cere surse concrete pentru fiecare valoare și test de adecvare (exemple de calcule manuale pentru 2-3 proiecte de referință).

**Risc tehnic / academic:**
- Motorul BOM este implementat (`backend/src/modules/bom/bomService.ts`) și folosește formule deterministe; comisia poate solicita dovezi suplimentare (set de teste, calcule manuale) pentru a valida corectitudinea și reproducibilitatea rezultatelor.
- Datele financiare sunt bazate pe seed estimativ — nu sunt valide ca deviz oficial fără actualizare și audit de sursă.
- AI folosit pentru verdicturi normative pare să includă fragmente citate (RAG), dar trebuie demonstrat că citările sunt exacte (ID capitol / paragraf) — recomandat a se loga chunk-id-urile returnate.

- Adăugați testare și probe de reproducere: scrieți unit tests/integration tests pentru `bomService.ts` care validează evaluarea formularelor (3 proiecte de referință) și confirmă costurile calculate față de calcule manuale. Asigurați test coverage pentru cazuri seismice/soluri diferite.
- Marcați în UI orice deviz afișat ca "estimativ" și afișați `lastUpdated` pentru prețuri.
- Înregistrați provenance pentru fiecare explicație AI: includeți sursele normative și identificatorul chunk returnat (sursa + capitol). Astfel comisia poate verifica ușor referințele citate.
- Puteți păstra AI pentru explicații și validări, DAR nu îi permiteți să modifice calculele numerice fără o verificare deterministă (dublă). Păstrați regula: AI explică, motorul calculează.
- Documentați procedura de actualizare a prețurilor (cron de scraping, API-uri, sau proces manual) și adăugați `priceHistory` în modelul Prisma.
- Adăugați test automat pentru `bom-formulas.json` care validează expresiile (parse + evaluare la valori de test) și verifică referințele normative prezente în `docsAI/`.

**Pași următori disponibili (pot face eu):**
- Pot genera imediat un `bomService.ts` minimal care evaluează `bom-formulas.json` pentru un proiect de test (ex.: proiect demo din DB) + teste unitare și script de seed demonstrativ.
- Pot completa raportul cu exemple concrete (ex: calcul demonstrativ pentru un proiect P+1) — dacă doriți, spuneți-mi un exemplu de dimensiuni (perimetru, înălțime, etaje).

---
Raport generat automat: [docs/bom_audit.md](docs/bom_audit.md)
