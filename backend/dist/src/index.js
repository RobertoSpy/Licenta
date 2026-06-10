"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const rateLimiter_1 = require("./core/middleware/rateLimiter");
const authRoutes_1 = __importDefault(require("./modules/auth/authRoutes"));
const projectRoutes_1 = __importDefault(require("./modules/project/projectRoutes"));
const terrainRoutes_1 = __importDefault(require("./modules/terrain/terrainRoutes"));
const aiRoutes_1 = __importDefault(require("./modules/ai/aiRoutes"));
const materialRoutes_1 = __importDefault(require("./modules/materials/materialRoutes"));
const editorRoutes_1 = __importDefault(require("./modules/editor/editorRoutes"));
const exportRoutes_1 = __importDefault(require("./modules/export/exportRoutes"));
const bomRoutes_1 = __importDefault(require("./modules/bom/bomRoutes"));
const constructionRoutes_1 = __importDefault(require("./modules/construction/constructionRoutes"));
const adminRoutes_1 = __importDefault(require("./modules/admin/adminRoutes"));
const marketRoutes_1 = __importDefault(require("./modules/market/marketRoutes"));
const contractorRoutes_1 = __importDefault(require("./modules/contractor/contractorRoutes"));
const quoteRoutes_1 = __importDefault(require("./modules/quote/quoteRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// ─────────────────────────────────────────────
// 1. SECURITATE: Helmet setează HTTP security headers
//    (X-Frame-Options, Content-Security-Policy, etc.)
// ─────────────────────────────────────────────
app.use((0, helmet_1.default)());
// ─────────────────────────────────────────────
// 2. CORS: Respinge origine necunoscute ÎNAINTE
//    de parsare body — cost minim per request respins
// ─────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true, // necesar pentru cookie-uri (Refresh Token)
}));
// ─────────────────────────────────────────────
// 3. PARSERE: JSON body + cookies
//    Ordinea contează: parsăm după CORS, înainte de rate limiter
// ─────────────────────────────────────────────
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use((0, cookie_parser_1.default)());
// ─────────────────────────────────────────────
// 4. RATE LIMITING GLOBAL: Gardian ieftin înainte de business logic
//    Protecție DDoS / brute-force la nivel de server
// ─────────────────────────────────────────────
app.use(rateLimiter_1.globalLimiter);
// ─────────────────────────────────────────────
// 5. HEALTH CHECK: Fără autentificare, fără rate limiting strict
// ─────────────────────────────────────────────
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─────────────────────────────────────────────
// 6. RUTE
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes_1.default);
app.use('/api/projects', projectRoutes_1.default);
app.use('/api/terrain', terrainRoutes_1.default);
app.use('/api/ai', aiRoutes_1.default);
app.use('/api/materials', materialRoutes_1.default);
app.use('/api/editor', editorRoutes_1.default);
app.use('/api/export', exportRoutes_1.default);
app.use('/api/bom', bomRoutes_1.default);
app.use('/api/construction', constructionRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/market', marketRoutes_1.default);
app.use('/api/contractors', contractorRoutes_1.default);
app.use('/api/quotes', quoteRoutes_1.default);
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
