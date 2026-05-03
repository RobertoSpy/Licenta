# Securitate Backend - BuildWise

Documentația detaliată a mecanismelor de securitate implementate pe serverul BuildWise (Node.js/Express).

---

## 1. Protecția Datelor și Validare

### 🔑 Hashing Parole (Bcrypt)
- Toate parolele sunt hash-uite folosind librăria `bcrypt` cu un **salt de 10 runde**.
- **Fisier**: [authController.ts](file:///c:/Users/Roberto/OneDrive/Desktop/Licenta/backend/src/controllers/authController.ts)
- Nicio parolă nu este stocată în format text clar în baza de date.

### ✅ Validarea Puterii Parolei
La înregistrare, serverul impune reguli stricte pentru parole:
- Minim 8 caractere.
- Cel puțin o majusculă (A-Z).
- Cel puțin o cifră (0-9).
- Cel puțin un caracter special (ex: !, @, #).

---

## 2. Gestiunea Sesiunilor și JWT

Sistemul utilizează un mecanism de **Dublu Token** pentru a preveni furtul de sesiune:

### Access Token (JWT)
- **Scop**: Autorizarea cererilor API pe termen scurt.
- **Valabilitate**: 15 minute.
- **Transmitere**: Body la login/refresh.
- **Verificare**: Middleware-ul `protect`.

### Refresh Token (JWT + Cookie)
- **Scop**: Menținerea sesiunii utilizatorului pe termen lung (7 zile).
- **Stocare**:
    1. **Baza de Date**: Câmpul `User.refreshToken` (pentru invalidare la logout).
    2. **Browser**: Cookie setat cu flag-urile `httpOnly: true`, `sameSite: 'strict'` și `secure: true` (în producție).
- **Beneficiu**: Fiind `httpOnly`, cookie-ul nu poate fi citit de JavaScript, eliminând riscul de furt prin XSS.

---

## 3. Middleware-uri de Securitate

### 🛡️ [authMiddleware.ts](file:///c:/Users/Roberto/OneDrive/Desktop/Licenta/backend/src/middleware/authMiddleware.ts)
Middleware-ul `protect` verifică header-ul `Authorization`:
1. Extrage token-ul de tip `Bearer`.
2. Verifică semnătura folosind `JWT_ACCESS_SECRET`.
3. Injectează ID-ul utilizatorului în obiectul `req.user` pentru a fi folosit în controllere (ex: `projectController.ts`).

### 🌐 [index.ts](file:///c:/Users/Roberto/OneDrive/Desktop/Licenta/backend/src/index.ts)
- **CORS**: Configurat strict pentru a accepta cereri doar de la `http://localhost:5173` și pentru a permite transmiterea credențialelor (cookies).
- **Cookie Parser**: Necesar pentru extragerea și validarea Refresh Token-ului.

---

## 4. Securitatea Bazei de Date (Prisma)
- **SQL Injection**: Utilizarea Prisma ORM previne implicit atacurile de tip SQL Injection prin utilizarea query-urilor parametrizate.
- **Environment Variables**: Toate cheile secrete (`JWT_SECRET`) și datele de conexiune la DB sunt stocate în `.env` și nu sunt incluse în codul sursă.

---

## 5. Fluxul de Logout
La apelarea `/api/auth/logout`:
1. Refresh token-ul este șters din baza de date a utilizatorului.
2. Cookie-ul `jwt` este șters din browser prin `res.clearCookie`.
3. Sesiunea devine invalidă imediat pentru orice tentativă de refresh.
