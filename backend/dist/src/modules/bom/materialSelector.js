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
exports.selectMaterialForBOM = selectMaterialForBOM;
const prisma_1 = require("../../lib/prisma");
function selectMaterialForBOM(query, budgetCategory, engineSuggestedCode, projectSeismicZoneFloat // e.g. 0.25 from "0.25g"
) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // 1. STRICT_NORMATIVE: Ignorăm bugetul, respectăm strict motorul (ex. C25/30)
        if (query.type === 'STRICT_NORMATIVE') {
            if (!engineSuggestedCode) {
                throw new Error(`Lipsă engineSuggestedCode pentru ${query.engineKey}`);
            }
            const material = yield prisma_1.prisma.material.findUnique({
                where: { internalCode: engineSuggestedCode }
            });
            // Fallback logic handled in bomService if null
            return material;
        }
        // Definim filtrele de bază
        const whereClause = {
            category: query.category,
            inStock: true
        };
        if (query.subcategory) {
            whereClause.subcategory = query.subcategory;
        }
        // 2. NORMATIVE_BUDGET: Aplicăm constrângerile + sortăm funcție de buget
        if (query.type === 'NORMATIVE_BUDGET') {
            // Aplicăm constrângerile normative
            if ((_a = query.constraints) === null || _a === void 0 ? void 0 : _a.maxUValue) {
                whereClause.uValue = { lte: query.constraints.maxUValue };
            }
            if ((_b = query.constraints) === null || _b === void 0 ? void 0 : _b.minStrength) {
                whereClause.compressiveStrength = { gte: query.constraints.minStrength };
            }
            if (projectSeismicZoneFloat !== undefined) {
                whereClause.OR = [
                    { minSeismicZone: { lte: projectSeismicZoneFloat } },
                    { minSeismicZone: null }
                ];
            }
            // Human-in-the-loop: pt structură ne bazăm pe materiale verificate
            // (Omitere momentană dacă catalogul e la început, dar ideal ar fi isVerified: true)
        }
        // 3. FREE_PREFERENCE: Nicio constrângere suplimentară, doar sortare
        const orderByClause = budgetCategory === 'economic'
            ? { pricePerUnit: 'asc' }
            : { pricePerUnit: 'asc' };
        const conformingMaterials = yield prisma_1.prisma.material.findMany({
            where: whereClause,
            orderBy: orderByClause
        });
        if (!conformingMaterials.length) {
            return null; // Va fi logat și va sări formula respectivă în bomService
        }
        // Extragem materialul corect din listă
        if (budgetCategory === 'mediu') {
            return conformingMaterials[Math.floor(conformingMaterials.length / 2)];
        }
        return conformingMaterials[0];
    });
}
