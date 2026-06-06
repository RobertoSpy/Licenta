import request from 'supertest';
import express from 'express';
import { prismaMock } from '../setup';
import projectRoutes from '../../src/modules/project/projectRoutes';

const app = express();
app.use(express.json());

// Mocam securitatea pentru a simula utilizatorul 1 (Client autentificat)
jest.mock('../../src/core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    req.user = { id: 1 };
    next();
  }
}));

app.use('/api/projects', projectRoutes);

describe('Projects & Configurator API (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/projects - ar trebui sa listeze toate proiectele userului curent', async () => {
    // Returnăm un array mock-uit din Prisma
    prismaMock.project.findMany.mockResolvedValue([
      { id: 10, title: 'Casa Visurilor', userId: 1, wizardStep: 4, isCompleted: true } as any
    ]);

    const response = await request(app).get('/api/projects');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].title).toBe('Casa Visurilor');
  });

  it('POST /api/projects - ar trebui sa creeze un proiect nou', async () => {
    // Simulăm crearea cu succes în DB
    prismaMock.project.create.mockResolvedValue({
      id: 11,
      title: 'Proiect nou de test',
      userId: 1,
      createdAt: new Date()
    } as any);

    const response = await request(app)
      .post('/api/projects')
      .send({ title: 'Proiect nou de test' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Proiect nou de test');
  });
});
