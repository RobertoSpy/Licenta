import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT;
const prisma = new PrismaClient();

// Configurare CORS pentru a permite trimiterea cookie-urilor de Refresh
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Punct de intrare rute de Autentificare
app.use('/api/auth', authRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Backend! Conexiunea funcționează!' });
});

app.get('/api/materials', async (req: Request, res: Response) => {
  try {
    const materials = await prisma.material.findMany();
    res.json(materials);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Eroare la preluarea materialelor" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
