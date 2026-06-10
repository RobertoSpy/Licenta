"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const prisma_1 = require("../lib/prisma");
const DEFAULT_PHASES = [
    { name: '1. Fundație', description: 'Cofraj, armare, turnare beton', phaseOrder: 1 },
    { name: '2. Structură', description: 'Stâlpi, grinzi, pereți portanți, zidărie', phaseOrder: 2 },
    { name: '3. Planșeu', description: 'Planșeu, grinzi, armătură superioară', phaseOrder: 3 },
    { name: '4. Acoperiș', description: 'Lemnărie, folie, țiglă/tablă, sistem pluvial', phaseOrder: 4 },
    { name: '5. Finisaje', description: 'Șapă, tencuială, glet, vopsea, pardoseli', phaseOrder: 5 },
    { name: '6. Tâmplărie', description: 'Uși, ferestre exterioare și interioare', phaseOrder: 6 },
    { name: '7. Termoizolație', description: 'Izolație fațadă (ETICS), vată minerală, termosistem', phaseOrder: 7 },
    { name: '8. Instalații Electrice', description: 'Cablaje, doze, tablou electric, prize', phaseOrder: 8 },
    { name: '9. Instalații Sanitare și Termice', description: 'Tubulatură, alimentare apă, canalizare, încălzire', phaseOrder: 9 }
];
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Migrating existing project phases...');
        const projects = yield prisma_1.prisma.project.findMany();
        for (const project of projects) {
            // Delete existing phases
            yield prisma_1.prisma.constructionPhase.deleteMany({
                where: { projectId: project.id }
            });
            // Create new 9 phases
            yield prisma_1.prisma.constructionPhase.createMany({
                data: DEFAULT_PHASES.map(phase => (Object.assign({ projectId: project.id }, phase)))
            });
            console.log(`Updated phases for project ${project.id}`);
        }
        console.log('Done!');
    });
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.prisma.$disconnect();
}));
