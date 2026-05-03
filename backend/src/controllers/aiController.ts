import { Request, Response } from 'express';
import { agentOrchestrator } from '../services/ai/agentOrchestrator';

export const aiController = {
  /**
   * Endpoint de chat pentru AI Assistant. Oferă răspunsul folosind Server-Sent Events (SSE).
   */
  async chatStream(req: Request, res: Response): Promise<void> {
    try {
      const { message, contextString, conversationHistory } = req.body;
      
      if (!message) {
        res.status(400).json({ error: "Mesajul este obligatoriu." });
        return;
      }

      // 1. Configurăm Header-ele pentru o conexiune de tip EVENT STREAM (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Trimitere headere imediata

      // 2. Apelăm Orchestratorul care se ocupă de RAG și CAG și obținem stream-ul Gemini
      const stream = await agentOrchestrator.getAiStreamForChat(
        message, 
        contextString || "Fără context special generat din formularul anterior.",
        conversationHistory || []
      );

      // 3. Iterăm prin stream-ul primit de la Google și îl propagăm către client (Browser) bucată cu bucată
      for await (const chunk of stream) {
        if (chunk.text) {
          // Format SSE standard: data: { json }\n\n
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // 4. Semnalizăm sfârșitul stream-ului
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (e: any) {
      console.error('SSE Error:', e);
      // Daca au fost deja trimise headere SSE si a dat eroare pe parcurs
      res.write(`data: ${JSON.stringify({ text: "\n[EROARE DE CONEXIUNE. ÎNCERCAȚI DIN NOU.]" })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
};
