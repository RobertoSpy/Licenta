"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const p = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const bySource = yield p.$queryRaw `
    SELECT source, agent, applicability, COUNT(*)::int as total 
    FROM "NormativeChunk" 
    WHERE source IN ('CR1-1-4-2012', 'Legea350-2001', 'NP051-2012', 'NP057-2002', 'P118-99')
    GROUP BY source, agent, applicability 
    ORDER BY source, total DESC
  `;
        console.log('\n=== Chunks pentru sursele architectural/residential ===');
        console.table(bySource);
        // Verificam daca exista chunks cu embedding pentru aceste surse
        const withEmb = yield p.$queryRaw `
    SELECT source, COUNT(*)::int as with_embedding, 
           COUNT(CASE WHEN embedding IS NULL THEN 1 END)::int as no_embedding
    FROM "NormativeChunk" 
    WHERE source IN ('CR1-1-4-2012', 'Legea350-2001', 'NP051-2012', 'NP057-2002', 'P118-99')
    GROUP BY source
  `;
        console.log('\n=== Embeddings per sursă ===');
        console.table(withEmb);
    });
}
main().finally(() => p.$disconnect());
