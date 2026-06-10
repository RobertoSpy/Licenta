"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
prisma.material.findFirst({ where: { name: { contains: 'Ferestre PVC 2 geamuri Low-E' } } }).then(m => console.log('Ferestre:', JSON.stringify(m, null, 2))).catch(console.error).finally(() => prisma.$disconnect());
