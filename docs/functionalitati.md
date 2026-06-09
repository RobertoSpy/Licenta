# Stadiul Implementării Funcționalităților BuildWise

Mai jos este prezentată detalierea tuturor modulelor aplicației și stadiul lor curent de dezvoltare (Backend și Frontend).

---

## 1. Autentificare și Managementul Contului 
**Status: ✅ IMPLEMENTAT COMPLET**

- **Înregistrare Securizată**: Funcționează integral, cu hashing `bcrypt` pe server și validare de parolă complexă.
- **Login cu Silent Refresh**: Sistemul de dublu token (Access/Refresh) este funcțional.
- **Sesiune Persistentă**: Utilizatorul rămâne logat sigur prin cookie-uri `httpOnly`.
- **Protecție Rute**: Gărzile de acces (`ProtectedRoute`) sunt active pe toate paginile de dashboard.

---

## 2. Configuratorul de Proiect (Project Wizard)
**Status: 🏗️ UI FINALIZAT / LOGICĂ BAZĂ ÎN LUCRU**

- **Interfață (3 Pași)**: Navigarea între pașii de Localizare, Teren și Viziune este completă și animată (`framer-motion`).
- **Harta (Step 1)**: Integrarea cu Leaflet pentru selectarea locației este funcțională.
- **Input-uri Date (Step 2 & 3)**: Toate formularele de colectare date (lățime, lungime, stil, etaje) funcționează vizual.
- **Salvarea în DB**: 🟠 **ÎN LUCRU (TODO)** - Momentan datele se afișează doar în consola browserului la apăsarea "Finalizează".

---

## 3. Analiza Pieței și Trenduri
**Status: 🧪 PLACEHOLDER (HARDCODAT)**

- **UI Dashboard**: Structura vizuală a analizei este gata.
- **Date Istorice**: Prețurile și tendințele afișate sunt momentan statice (mock data).
- **Grafice**: Integrarea cu Recharts pentru vizualizarea interactivă a inflației materialelor urmează să fie realizată.

---

## 4. Catalogul de Materiale
**Status: 🟡 IMPLEMENTAT PARȚIAL**

- **Căutare & Filtrare**: Sistemul de căutare prin text și filtrarea pe categorii (Zidărie, Izolație etc.) este funcțional în frontend.
- **Backend API**: Există ruta `/api/materials` care livrează datele către frontend.
- **Update Prețuri**: ⚪ **VIITOR** - Prețurile urmează să fie preluate dinamic din surse externe sau update masiv.

---

## 5. Directorul de Experți
**Status: 🧪 PLACEHOLDER (HARDCODAT)**

- **Validare Firme**: Lista de experți și firme de construcții este momentan salvată static în frontend (`Experts.tsx`).
- **Rating-uri**: Sistemul de rating este afișat vizual, dar nu este legat de un sistem de feedback real în backend.

---

## 6. Managementul Devizelor (BOM - Bill of Materials)
**Status: ⚙️ INFRASTRUCTURĂ GATA / MOTOR CALCUL ÎN LUCRU**

- **Arhitectură DB**: Modelele Prisma pentru `ProjectBOM` și `Material` sunt pregătite în baza de date.
- **API Deviz**: Există capacitatea tehnică de a salva și cere un deviz prin ID proiect.
- **Motor de Calcul**: 🔴 **NEIMPLEMENTAT** - Logica matematică pentru a estima cantitățile de materiale în funcție de dimensiunile terenului (lățime x lungime) este următorul pas major de dezvoltare.
