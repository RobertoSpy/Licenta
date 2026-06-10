"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaMock = void 0;
const jest_mock_extended_1 = require("jest-mock-extended");
// Importăm instanța prisma reală
const prisma_1 = require("../src/lib/prisma");
// Suprascriem prisma cu mock-ul
jest.mock('../src/lib/prisma', () => ({
    prisma: (0, jest_mock_extended_1.mockDeep)(),
}));
// Exportăm mock-ul pentru a putea aserta pe el în teste (ex: prismaMock.user.findUnique.mockResolvedValue)
exports.prismaMock = prisma_1.prisma;
beforeEach(() => {
    jest.clearAllMocks();
});
