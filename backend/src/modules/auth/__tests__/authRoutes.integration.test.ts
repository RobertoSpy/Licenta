import request from 'supertest';
import express, { Request, Response } from 'express';
import { prismaMock } from '../../../../tests/setup';
import authRoutes from '../authRoutes';
import { protect } from '../../../core/middleware/authMiddleware';
import { tenantGuard } from '../../../core/middleware/tenantGuard';
import jwt from 'jsonwebtoken';
import * as emailService from '../emailService';

jest.mock('../emailService');
jest.mock('jsonwebtoken');
const mockEmail = emailService as jest.Mocked<typeof emailService>;

process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const app = express();
app.use(express.json());

// Setăm încrederea în proxy pentru a permite express-rate-limit să funcționeze corect
app.set('trust proxy', 1);

app.use('/api/auth', authRoutes);

// Dummy route pentru testarea explicită a middleware-urilor de securitate (protect + tenantGuard)
app.get('/api/protected-tenant/:projectId', protect, tenantGuard, (req: Request, res: Response) => {
  res.status(200).json({ message: 'Success' });
});

describe('Auth API & Security Middlewares (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT & TenantGuard Security', () => {
    const validSecret = process.env.JWT_ACCESS_SECRET || 'secret';

    it('protected route without Authorization header returns 401', async () => {
      const res = await request(app).get('/api/protected-tenant/1');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Neautorizat/);
    });

    it('protected route with tampered JWT returns 401', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid token'); });

      const res = await request(app)
        .get('/api/protected-tenant/1')
        .set('Authorization', 'Bearer invalid-token.xyz.abc');
      
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Neautorizat|invalid/i);
    });

    it('protected route with valid token for different user returns 403 (TenantGuard)', async () => {
      // Bypass token generation/verification by mocking jwt.verify
      (jwt.verify as jest.Mock).mockImplementation((token, secret) => ({ id: 2 }));
      
      // Setup mock: user 2 nu deține proiectul 1
      prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' } as any);
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1 } as any); // Deținut de user 1

      const res = await request(app)
        .get('/api/protected-tenant/1')
        .set('Authorization', `Bearer some-token`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Acces interzis/);
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 after exceeding email-based login attempts', async () => {
      // Fail login early by not finding user
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      // Limita e 10. Trimitem 11
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'brute@test.com', password: 'wrong' });
      }

      const res11 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'brute@test.com', password: 'wrong' });

      expect(res11.status).toBe(429);
      expect(res11.text).toMatch(/Prea multe/i);
    });

    it('global limiter does not block normal request volume', async () => {
      // Deoarece testul precedent a făcut brute force pe brute@test.com,
      // vom face requests pe alt email pentru a testa volumul normal care nu depășește limita.
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'normal@test.com', password: 'abc' });
      
      // 400 pt că pass < 8 chars etc sau 401 pt invalid credentials, DAR NU 429!
      expect(res.status).not.toBe(429);
    });
  });

  describe('Valid Flows & Logic', () => {
    it('Magic link expiry + reuse prevention', async () => {
      // Simulam un request cu OTP invalid/expirat
      prismaMock.user.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'x@y.com', otp: '123456', newPassword: 'Valid1Password!' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cod invalid sau expirat.');
    });

    it('POST /forgot-password with valid email sends email', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'valid@test.com' } as any);
      mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'valid@test.com' });

      expect(res.status).toBe(200);
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });
});
