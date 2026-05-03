# Arhitectura Sistemului BuildWise

BuildWise este o platformă modernă dedicată gestionării proiectelor de construcții, oferind instrumente pentru configurarea caselor, analiza pieței și managementul devizelor (BOM).

## 1. Stack Tehnologic

### Frontend
- **Framework**: React 19 (Vite)
- **Limbaj**: TypeScript
- **Stilizare**: Tailwind CSS 4 & Vanilla CSS
- **Animatii**: Framer Motion
- **Iconițe**: Lucide React
- **Routing**: React Router DOM (v7)
- **Hărți**: React Leaflet (integrare Proj4 pentru coordonate)
- **State Management**: React Context API (`AuthContext`)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Limbaj**: TypeScript
- **ORM**: Prisma
- **Autentificare**: JWT (Access & Refresh tokens în HTTP-only cookies)
- **Middleware**: `cookie-parser`, `cors`, `dotenv`

### Bază de Date & Infrastructură
- **Database**: PostgreSQL 16
- **Orchestrare**: Docker & Docker Compose
- **Containerizare**: Servicii separate pentru `db`, `backend` și `frontend`.

---

## 2. Infrastructură (Docker)

Sistemul este complet containerizat folosind `docker-compose.yml`:
- **db**: Imagine oficială de PostgreSQL, date persistate în volumul `db-data`.
- **backend**: Build din directorul `./backend`, expune portul `3000`.
- **frontend**: Build din directorul `./frontend`, expune portul `5173`.

Configurarea se realizează prin variabile de mediu stocate în `.env` în rădăcina proiectului.

---

## 3. Modelul de Date (Prisma Schema)

Structura bazei de date este definită în `backend/prisma/schema.prisma`:

| Model | Descriere | Relații |
| :--- | :--- | :--- |
| **User** | Stochează datele utilizatorilor și hash-urile parolelor. | Are mai multe `Project`. |
| **Project** | Proiectul principal creat de utilizator, include date despre teren. | Aparține unui `User`, are mai multe `ProjectBOM`. |
| **Material** | Catalog de materiale disponibile cu prețuri și categorii. | Poate apărea în mai multe `ProjectBOM`. |
| **ProjectBOM** | Tabel de legătură pentru deviz (Bill of Materials). | Leagă `Project` de `Material` cu cantitate și preț total. |

---

## 4. Arhitectura API (Backend)

Backend-ul urmează un model Controller-Router:

### Rute Principale:
- `/api/auth`: `login`, `register`, `refresh`, `logout`.
- `/api/projects`: CRUD pentru proiectele utilizatorului (necesită autentificare).
- `/api/materials`: Preluarea listei de materiale.

### Autentificare:
Se folosește un sistem de dublu token:
1. **Access Token**: Valabilitate scurtă, trimis în header-ul de autorizare sau cookie.
2. **Refresh Token**: Valabilitate lungă, trimis în HTTP-only cookie, folosit pentru a genera noi access tokens.

---

## 5. Arhitectura Frontend

### Structura Directoarelor:
- `src/api`: Instanța Axios și apelurile către backend.
- `src/components/wizard`: Logica complexă a configuratorului de casă.
- `src/context`: Provider-ul de autentificare.
- `src/pages`: Vizualizările principale (Dashboard, Market, Materials, Experts).

### Fluxul Project Wizard:
Configuratorul de proiect (`ProjectWizard.tsx`) este un formular multi-pas:
1. **Pasul 1 (Location)**: Selectarea locației pe hartă.
2. **Pasul 2 (Terrain)**: Introducerea dimensiunilor și tipului de sol.
3. **Pasul 3 (Vision)**: Definirea stilului arhitectural și a numărului de etaje.

---

## 6. Securitate
- Parolele sunt hash-uite (presupus folosind bcrypt, de verificat în `authController.ts`).
- Rutele protejate sunt verificate prin middleware-ul `protect`.
- Se folosesc HTTP-only cookies pentru a preveni atacurile XSS asupra token-urilor.
