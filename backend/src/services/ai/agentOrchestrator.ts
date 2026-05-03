import { GoogleGenAI } from '@google/genai';
import { normativeCache } from './normativeCache';
import { ragService } from './ragService';

// Reinstanțiem GoogleGenAI (key preluat deja din proces, datorita load-ului facut în embeddingService/index)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const agentOrchestrator = {
  /**
   * Orchestrează interogarea RAG + CAG pentru a trimite un stream înapoi spre Frontend
   * @param userQuestion Ce discută utilizatorul
   * @param contextString Informații locale (ex. ce a rezultat din harta: zona Cluj...)
   * @param conversationHistory Istoricul conversației pentru menținerea contextului
   */
  async getAiStreamForChat(userQuestion: string, contextString: string, conversationHistory: {role: string, text: string}[] = []) {
    // 1. Încărcăm CAG (date cache statice)
    const staticNormatives = await normativeCache.load();
    
    // 2. Extragem contexte similare RAG
    const ragContext = await ragService.searchRelevantChunks(userQuestion, 3);
    
    let historyStr = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyStr = "ISTORIC CONVERSAȚIE:\n" + conversationHistory.map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`).join('\n') + "\n\n";
    }

    // 3. Compunem promptul
    const prompt = `Ești Zidario, un asistent tehnic AI expert în proiectarea și construcția caselor din România.
Rolul tău este să oferi suport tehnic direct, fără ocolveri, privind terenul, solul și normativele în vigoare, pe un ton prietenos dar extrem de precis.

CONTEXT CURENT UTILIZATOR (informații preluate automat):
${contextString}

NORMATIVE STATICE CURENTE (Pentru referință fixă - CAG):
${staticNormatives}

REGLEMENTĂRI PENTRU CONTEXTUL DISCUȚIEI (RAG - pagini relevante din PDF):
${ragContext}

${historyStr}ÎNTREBARE UTILIZATOR / MESAJ:
"${userQuestion}"

Răspunde profesionist, citează sursele (ex: Conform legii 114/1996..) dacă este nevoie, și fii clar! Pune paragrafe scurte. Dacă folosești markdown, folosește doar bold și liste. Fii la obiect.`;

    // 4. Returnăm "stream-ul" pentru chat
    try {
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-pro',
        contents: prompt
      });

      return responseStream;
    } catch (e: any) {
      console.error('Eroare Gemini AI Chat:', e.message);
      throw new Error('Serviciul de asistență tehnică nu este disponibil.');
    }
  }
};
