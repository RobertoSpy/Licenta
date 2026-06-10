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
exports.materialAnalyzer = exports.MaterialAnalyzerService = exports.materialAnalysisSchema = void 0;
const genai_1 = require("@google/genai");
const prisma_1 = require("../../../lib/prisma");
let aiInstance = null;
const getAi = () => {
    if (!aiInstance)
        aiInstance = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return aiInstance;
};
exports.materialAnalysisSchema = {
    type: genai_1.Type.OBJECT,
    properties: {
        standardCode: {
            type: genai_1.Type.STRING,
            description: "Codul standard al materialului. Bazează-te STRICT pe lista furnizată în instrucțiunile promptului, sau CUSTOM_MATERIAL."
        },
        category: {
            type: genai_1.Type.STRING,
            description: "Categoria principală. Valori posibile: Zidărie, Fundație, Finisaje Brute, Finisaje Fine, Acoperiș, Tâmplărie, Izolație, Armătură"
        },
        subcategory: {
            type: genai_1.Type.STRING,
            description: "Subcategoria opțională. Ex: Pereți exteriori, Uși interior"
        },
        unit: {
            type: genai_1.Type.STRING,
            description: "Unitatea de măsură logică pentru deviz: mp, mc, buc, kg, ml"
        },
        uValue: {
            type: genai_1.Type.NUMBER,
            description: "Coeficientul de transmitanță termică (W/m²K) dacă este aplicabil, altfel null. Valori tipice: BCA 25cm=~0.45, Cărămidă 30cm=~0.85"
        },
        pros: {
            type: genai_1.Type.STRING,
            description: "Un argument educațional scurt (max 10 cuvinte) despre principalul avantaj al materialului."
        },
        cons: {
            type: genai_1.Type.STRING,
            description: "Un argument educațional scurt (max 10 cuvinte) despre principalul dezavantaj."
        },
        description: {
            type: genai_1.Type.STRING,
            description: "O descriere prietenoasă tehnică de 1-2 propoziții."
        },
        brand: {
            type: genai_1.Type.STRING,
            description: "Numele brandului dacă reiese clar din titlu (ex: Ytong, Tondach, Dedeman), altfel null."
        },
        genericAlternatives: {
            type: genai_1.Type.ARRAY,
            items: { type: genai_1.Type.STRING },
            description: "Un array cu 1-3 tipuri generice de materiale alternative (ex: pentru BCA, alternativa e 'Cărămidă portantă')."
        }
    },
    required: ["standardCode", "category", "unit", "pros", "cons", "description", "genericAlternatives"]
};
class MaterialAnalyzerService {
    analyzeMaterial(rawTitle, price, url) {
        return __awaiter(this, void 0, void 0, function* () {
            const ai = getAi();
            // Extragem toate codurile existente din baza de date
            const dbMaterials = yield prisma_1.prisma.material.findMany({
                select: { internalCode: true }
            });
            const validCodes = dbMaterials.map(m => m.internalCode).join(', ');
            const prompt = `Ești un Data Engineer și expert în materiale de construcții rezidențiale din România.
Sistemul nostru a extras următorul produs real dintr-un magazin online:
Titlu: "${rawTitle}"
Preț: ${price} RON
URL Sursă: ${url}

Analizează acest material și întoarce un JSON structurat conform schemei cerute. Deduceți corect categoria și unitatea de măsură folosită de regulă în devize.
Mapează-l obligatoriu pe un 'standardCode' corespunzător sistemului de devize (BOM).
Trebuie să folosești STRICT unul dintre următoarele coduri din baza noastră de date:
[${validCodes}]
Dacă produsul nu se potrivește deloc cu funcționalitățile acestor coduri, folosește CUSTOM_MATERIAL.

Furnizează argumente 'pros', 'cons' și 'description' folosind un limbaj accesibil. Dacă menționezi termeni tehnici sau coeficienți, explică-i pe înțelesul unui om non-tehnic (viitor proprietar de casă).`;
            try {
                const response = yield ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: exports.materialAnalysisSchema,
                        temperature: 0.1, // Vrem răspunsuri deterministe și tehnice
                    }
                });
                const text = response.text;
                if (!text)
                    return null;
                const data = JSON.parse(text);
                return data;
            }
            catch (err) {
                console.error(`Eroare la analiza AI pentru materialul "${rawTitle}":`, err);
                return null;
            }
        });
    }
}
exports.MaterialAnalyzerService = MaterialAnalyzerService;
exports.materialAnalyzer = new MaterialAnalyzerService();
