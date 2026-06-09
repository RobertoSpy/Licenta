import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authEmailLimiter } from '../middleware/rateLimiter';

describe('Infrastructure & Security Shield (Integration)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Helmet & CORS Policies', () => {
    it('ar trebui sa aplice antetele de securitate Helmet impotriva XSS si Clickjacking', async () => {
      app.use(helmet());
      app.get('/health', (req, res) => res.status(200).send('OK'));

      const res = await request(app).get('/health');
      
      // Helmet setează automat o serie de antete stricte de securitate
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('ar trebui sa respinga atacurile CORS (Cross-Origin Resource Sharing) malitioase', async () => {
      app.use(cors({ origin: 'https://buildconstruct.ro' }));
      app.get('/health', (req, res) => res.status(200).send('OK'));

      const res = await request(app)
        .options('/health')
        .set('Origin', 'https://hacker-site.ru');
      
      // Daca originea e falsa, serverul nu va returna antetul favorabil (va bloca executia pe browser-ul client)
      expect(res.headers['access-control-allow-origin']).not.toBe('https://hacker-site.ru');
    });
  });

  describe('Rate Limiting (Anti DDoS & Brute Force)', () => {
    it('ar trebui sa blocheze atacurile de tip flood/DDoS', async () => {
      // Setăm un limiter global foarte strict exclusiv pentru test (2 requesturi maxime)
      const testGlobalLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
      });

      app.use('/api', testGlobalLimiter);
      app.get('/api/test', (req, res) => res.status(200).send('OK'));

      // Utilizator legitim
      await request(app).get('/api/test').expect(200);
      await request(app).get('/api/test').expect(200);
      
      // Bot / Hacker care incearca a 3-a oara
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(429); // 429 Too Many Requests
      expect(res.text).toContain('Too many requests');
    });

    it('ar trebui sa blocheze atacurile brute-force tintite strict pe un anumit cont de email, protejand restul platformei', async () => {
      // Folosim instanța reală din cod (10 încercări max)
      app.post('/api/auth/login', authEmailLimiter, (req, res) => res.status(200).send('LOGIN_OK'));

      // Hackerul incearca parola gresita de 10 ori pe contul lui Roberto
      for(let i=0; i < 10; i++){
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'roberto@example.com' })
          .expect(200);
      }

      // La a 11-a oară, serverul il baneaza!
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'roberto@example.com' });
      
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.text).toContain('Prea multe încercări pentru acest cont');

      // Dar un ALT utilizator legitim trebuie sa poata intra simultan
      const legitimateUserRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alt_utilizator@example.com' });
      
      expect(legitimateUserRes.status).toBe(200);
    });
  });
});
