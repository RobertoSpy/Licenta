import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// Importăm instanța prisma reală
import { prisma } from '../src/lib/prisma';

// Suprascriem prisma cu mock-ul
jest.mock('../src/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// Exportăm mock-ul pentru a putea aserta pe el în teste (ex: prismaMock.user.findUnique.mockResolvedValue)
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  jest.clearAllMocks();
});
