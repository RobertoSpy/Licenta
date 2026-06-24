import { GoogleGenAI, Type, Schema } from '@google/genai';
import { prisma } from '../../../lib/prisma';
import { ALL_SUBCATEGORIES } from '../../../data/taxonomy';

let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

export interface MaterialAnalysis {
  category: string;
  subcategory: string;
  structuralType: string | null;
  unit: string;
  packagingUnit: string | null;
  packagingValue: number | null;
  uValue: number | null;
  compressiveStrength: number | null;
  pros: string;
  cons: string;
  description: string;
  brand: string | null;
  internalCode: string;
  genericAlternatives: string[];
}

export const materialAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    internalCode: {
      type: Type.STRING,
      description: "Generează un cod unic în format UPPER_SNAKE_CASE (fără spații sau caractere speciale). Format: BRAND_TIP_SPECIFICATIE. Ex: YTONG_BCA_25, DEDEMAN_FIER_12, APLA_GLET_FINISAJ."
    },
    category: {
      type: Type.STRING,
      description: "Categoria principală. Valori posibile: Structură, Fundație, Finisaje Brute, Finisaje, Acoperiș, Tâmplărie, Termoizolație, Instalații"
    },
    subcategory: {
      type: Type.STRING,
      description: "Subcategoria exactă din lista permisă în prompt (în limba română)."
    },
    structuralType: {
      type: Type.STRING,
      nullable: true,
      description: "Tipul structural (doar pentru Structură). Valori posibile: BCA, CARAMIDA, BETON, LEMN. Dacă nu se aplică, va fi null."
    },
    unit: {
      type: Type.STRING,
      description: "Unitatea de măsură logică pentru deviz (ex: buc, mp, mc, kg, litri, sac, ml)."
    },
    packagingUnit: {
      type: Type.STRING,
      nullable: true,
      description: "Unitatea de ambalare. Ex: dacă produsul vine la 'palet', 'sac', 'cutie', 'bax'. Dacă scrie '1.56 mc/palet', unit e 'mc' și packagingUnit e 'palet'."
    },
    packagingValue: {
      type: Type.NUMBER,
      nullable: true,
      description: "Cantitatea din ambalaj referitoare la unitatea de bază. Ex: pt '1.56 mc/palet', valoarea e 1.56."
    },
    uValue: {
      type: Type.NUMBER,
      nullable: true,
      description: "Coeficientul de transmitanță termică (W/m²K) dacă este aplicabil, altfel null."
    },
    compressiveStrength: {
      type: Type.NUMBER,
      nullable: true,
      description: "Rezistența la compresiune (N/mmp sau N/mm²), doar dacă este clar specificată. Altfel null."
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
      description: "O descriere tehnică de 1-2 propoziții care va fi folosită în RAG."
    },
    brand: {
      type: Type.STRING,
      nullable: true,
      description: "Numele brandului dacă reiese clar din titlu (ex: Ytong, Tondach, Dedeman), altfel null."
    },
    genericAlternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Un array cu 1-3 tipuri generice de materiale alternative."
    }
  },
  required: ["internalCode", "category", "subcategory", "unit", "pros", "cons", "description", "genericAlternatives", "compressiveStrength"]
};

export class MaterialAnalyzerService {
  async analyzeMaterial(rawTitle: string, price: number, url: string, rawSpecs?: Record<string, string>): Promise<MaterialAnalysis | null> {
    const ai = getAi();
    
    let specsString = '';
    if (rawSpecs) {
      specsString = Object.entries(rawSpecs).map(([k, v]) => `${k}: ${v}`).join('\n');
    }

    const prompt = `Ești un Data Engineer și expert structurist pentru o aplicație de devize.
Sistemul a extras următorul produs dintr-un magazin online:
Titlu: "${rawTitle}"
Preț: ${price} RON
URL: ${url}
Specificații:
${specsString}

Sarcina ta este să clasifici acest material. 
Trebuie să alegi STRICT un "subcategory" din următoarea listă oficială (copy-paste exact cum scrie aici):
${ALL_SUBCATEGORIES.join(', ')}

Dacă materialul nu se potrivește deloc în aceste categorii, returnează "MATERIAL_CUSTOM" la subcategory.
La "structuralType" alege "BCA" sau "CARAMIDA" pentru zidărie, altfel null.
Te rog să extragi și detaliile de împachetare dacă există (ex: dacă titlul sau specificațiile indică "sac 25 kg", packagingUnit va fi "kg" și packagingValue va fi 25).`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: materialAnalysisSchema,
          temperature: 0.1, 
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
