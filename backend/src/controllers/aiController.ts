import { Request, Response } from 'express';
import { agentOrchestrator } from '../services/ai/agentOrchestrator';
import { GoogleGenAI } from '@google/genai';

// Lazy init — același pattern ca în orchestrator
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

export const aiController = {
  /**
   * POST /api/ai/chat
   * Endpoint de chat pentru Zidario AI. Răspunde prin Server-Sent Events (SSE).
   * Acceptă opțional `screenContext` pentru rutare SCREEN_AGENTS.
   */
  async chatStream(req: Request, res: Response): Promise<void> {
    try {
      const { message, contextString, conversationHistory, screenContext } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Mesajul este obligatoriu.' });
        return;
      }

      // Configurăm headerele SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Apelăm orchestratorul cu screenContext opțional
      const stream = await agentOrchestrator.getAiStreamForChat(
        message,
        contextString || 'Fără context special generat din formularul anterior.',
        conversationHistory || [],
        screenContext  // transmis la SCREEN_AGENTS router
      );

      // Stream progresiv către client
      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();

    } catch (e: any) {
      console.error('[aiController.chatStream] Eroare:', e);
      res.write(`data: ${JSON.stringify({ text: '\n[EROARE DE CONEXIUNE. ÎNCERCAȚI DIN NOU.]' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  },

  /**
   * POST /api/ai/summarize
   * Rezumă o conversație lungă în maxim 200 de cuvinte.
   * Apel simplu Gemini (non-streaming) — rezumatul e scurt și rapid.
   * Folosit de useZidarioChat la MAX_HISTORY mesaje.
   */
  async summarizeConversation(req: Request, res: Response): Promise<void> {
    try {
      const { systemPrompt, text } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Textul conversației este obligatoriu.' });
        return;
      }

      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${text}`
        : text;

      const result = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          maxOutputTokens: 400,
          temperature: 0.3  // mai puțin creativ, mai determinist la rezumat
        }
      });

      const summary = result.text ?? '';
      res.json({ summary });

    } catch (e: any) {
      console.error('[aiController.summarizeConversation] Eroare:', e);
      res.status(500).json({ error: 'Serviciul de rezumare nu este disponibil.' });
    }
  }
};
