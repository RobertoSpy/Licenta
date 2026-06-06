import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const prompt = `Ești Zidario, consultant tehnic pentru construcții rezidențiale românești.

SARCINI (răspunde structurat, maxim 200 cuvinte, în română):
1. ✅/❌ COMPATIBILITATE: Este alternativa compatibilă cu zona seismică mare și solul pietros?
2. 🔧 COMPATIBILITATE MATERIALE: Se potrivește cu celelalte materiale alese în deviz?
3. 🌡️ IMPACT ENERGETIC: Cum afectează clasa energetică? (compară U-values dacă disponibile)
4. 💰 VERDICT FINANCIAR: Merită diferența de preț pentru acest proiect specific?
5. 📋 NORMATIVE: Citează articolul exact dacă există restricții (CR6-2013, NE012-1:2022, Mc-001-2022, P100-1/2013).

IMPORTANT: Dacă alternativa este incompatibilă cu zona seismică sau solul, spune NU clar și motivează.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: 400, temperature: 0.2 }
    });

    for await (const chunk of stream) {
      console.log('CHUNK RAW:', JSON.stringify(chunk, null, 2));
      console.log('CHUNK TEXT:', chunk.text);
    }
  } catch (e) {
    console.error('ERROR:', e);
  }
}
test();
