import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { globalLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import terrainRoutes from './routes/terrainRoutes';
import aiRoutes from './routes/aiRoutes';
import materialRoutes from './routes/materialRoutes';
import editorRoutes from './routes/editorRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// 1. SECURITATE: Helmet setează HTTP security headers
//    (X-Frame-Options, Content-Security-Policy, etc.)
// ─────────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────────
// 2. CORS: Respinge origine necunoscute ÎNAINTE
//    de parsare body — cost minim per request respins
// ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // necesar pentru cookie-uri (Refresh Token)
}));

// ─────────────────────────────────────────────
// 3. PARSERE: JSON body + cookies
//    Ordinea contează: parsăm după CORS, înainte de rate limiter
// ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─────────────────────────────────────────────
// 4. RATE LIMITING GLOBAL: Gardian ieftin înainte de business logic
//    Protecție DDoS / brute-force la nivel de server
// ─────────────────────────────────────────────
app.use(globalLimiter);

// ─────────────────────────────────────────────
// 5. HEALTH CHECK: Fără autentificare, fără rate limiting strict
// ─────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// 6. RUTE
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/terrain', terrainRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/editor', editorRoutes);

// ─────────────────────────────────────────────
// 7. FALLBACK: Rută necunoscută
// ─────────────────────────────────────────────
app.use((_, res) => {
  res.status(404).json({ message: 'Ruta nu există.' });
});

// ─────────────────────────────────────────────
// 8. PORNIRE SERVER
// ─────────────────────────────────────────────
app.listen(port, () => {
  console.log(`[Server] Running on port ${port}`);
});
