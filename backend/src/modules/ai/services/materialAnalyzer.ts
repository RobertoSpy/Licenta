import { GoogleGenAI, Type, Schema } from '@google/genai';
import { prisma } from '../../../lib/prisma';

let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

export interface MaterialAnalysis {
  standardCode: string;
  category: string;
  subcategory: string;
  unit: string;
  uValue: number | null;
  pros: string;
  cons: string;
  description: string;
  brand: string | null;
  genericAlternatives: string[];
}

export const materialAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    standardCode: {
      type: Type.STRING,
      description: "Codul standard al materialului. Bazează-te STRICT pe lista furnizată în instrucțiunile promptului, sau CUSTOM_MATERIAL."
    },
    category: {
      type: Type.STRING,
      description: "Categoria principală. Valori posibile: Zidărie, Fundație, Finisaje Brute, Finisaje Fine, Acoperiș, Tâmplărie, Izolație, Armătură"
    },
    subcategory: {
      type: Type.STRING,
      description: "Subcategoria opțională. Ex: Pereți exteriori, Uși interior"
    },
    unit: {
      type: Type.STRING,
      description: "Unitatea de măsură logică pentru deviz: mp, mc, buc, kg, ml"
    },
    uValue: {
      type: Type.NUMBER,
      description: "Coeficientul de transmitanță termică (W/m²K) dacă este aplicabil, altfel null. Valori tipice: BCA 25cm=~0.45, Cărămidă 30cm=~0.85"
    },
    pros: {
      type: Type.STRING,
      description: "Un argument educațional scurt (max 10 cuvinte) despre principalul avantaj al materialului."
    },
    cons: {
      type: Type.STRING,
      description: "Un argument educațional scurt (max 10 cuvinte) despre principalul dezavantaj."
    },
    description: {
      type: Type.STRING,
      description: "O descriere prietenoasă tehnică de 1-2 propoziții."
    },
    brand: {
      type: Type.STRING,
      description: "Numele brandului dacă reiese clar din titlu (ex: Ytong, Tondach, Dedeman), altfel null."
    },
    genericAlternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Un array cu 1-3 tipuri generice de materiale alternative (ex: pentru BCA, alternativa e 'Cărămidă portantă')."
    }
  },
  required: ["standardCode", "category", "unit", "pros", "cons", "description", "genericAlternatives"]
};

export class MaterialAnalyzerService {
  async analyzeMaterial(rawTitle: string, price: number, url: string): Promise<MaterialAnalysis | null> {
    const ai = getAi();
    
    // Extragem toate codurile existente din baza de date
    const dbMaterials = await prisma.material.findMany({
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: materialAnalysisSchema,
          temperature: 0.1, // Vrem răspunsuri deterministe și tehnice
        }
      });

      const text = response.text;
      if (!text) return null;
      
      const data = JSON.parse(text) as MaterialAnalysis;
      return data;
    } catch (err) {
      console.error(`Eroare la analiza AI pentru materialul "${rawTitle}":`, err);
      return null;
    }
  }
}

export const materialAnalyzer = new MaterialAnalyzerService();
