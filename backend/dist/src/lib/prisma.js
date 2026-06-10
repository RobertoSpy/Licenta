"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const prisma = (_a = globalThis.prisma) !== null && _a !== void 0 ? _a : new client_1.PrismaClient();
exports.prisma = prisma;
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}
