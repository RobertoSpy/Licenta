import { Request, Response } from 'express';
import { agentOrchestrator, suggestRoomProgram } from '../services/ai/agentOrchestrator';
import { chatSummaryRepository } from '../repositories/chatSummaryRepository';
import { projectRepository } from '../repositories/projectRepository';
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
      const { message, contextString, conversationHistory, screenContext, historySummary } = req.body;

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
        screenContext,
        historySummary ?? null
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
  },

  /**
   * GET /api/ai/summary/:projectId?phase=...&screen=...
   * Returnează rezumatul existent pentru un ecran specificat.
   * Folosit de useZidarioChat la mount pentru a restaura contextul.
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      // Ownership verificat de tenantGuard — req.project este disponibil
      const projectId = parseInt(req.params.projectId as string);
      const phase = req.query.phase as string;
      const screen = req.query.screen as string | undefined;

      if (!phase) {
        res.status(400).json({ error: 'phase este obligatoriu.' });
        return;
      }

      const summary = await chatSummaryRepository.getOne(projectId, phase, screen ?? null);
      res.json({ summary: summary?.summary ?? null });
    } catch (e: any) {
      console.error('[aiController.getSummary] Eroare:', e);
      res.status(500).json({ error: 'Eroare la citirea rezumatului.' });
    }
  },

  /**
   * POST /api/ai/summary
   * Salvează (upsert) rezumatul pentru un ecran specificat.
   * Apelat automat de useZidarioChat la fiecare 10 mesaje.
   */
  async saveSummary(req: Request, res: Response): Promise<void> {
    try {
      // Ownership verificat de tenantGuard — req.project este disponibil
      const { projectId, phase, screen, summary } = req.body;

      if (!phase || !summary) {
        res.status(400).json({ error: 'phase și summary sunt obligatorii.' });
        return;
      }

      const result = await chatSummaryRepository.upsert(
        projectId,
        phase,
        screen ?? null,
        summary
      );
      res.json({ success: true, id: result.id });
    } catch (e: any) {
      console.error('[aiController.saveSummary] Eroare:', e);
      res.status(500).json({ error: 'Eroare la salvarea rezumatului.' });
    }
  },

  /**
   * POST /api/ai/suggest-rooms
   * Generează programul funcțional recomandat de AI pentru un proiect.
   * Body: { projectId, familySize, budgetCategory }
   * Ownership verificat prin tenantGuard (extrage projectId din body).
   */
  async suggestRooms(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, familySize, budgetCategory, houseAreaSqm } = req.body;

      if (!projectId || !familySize || !budgetCategory || !houseAreaSqm) {
        res.status(400).json({ error: 'projectId, familySize, budgetCategory și houseAreaSqm sunt obligatorii.' });
        return;
      }

      const validBudgets = ['economic', 'mediu', 'premium'];
      if (!validBudgets.includes(budgetCategory)) {
        res.status(400).json({ error: `budgetCategory invalid. Valori acceptate: ${validBudgets.join(', ')}` });
        return;
      }

      const familySizeNum = parseInt(familySize, 10);
      if (isNaN(familySizeNum) || familySizeNum < 1 || familySizeNum > 20) {
        res.status(400).json({ error: 'familySize trebuie să fie un număr între 1 și 20.' });
        return;
      }

      // Ownership deja verificat de tenantGuard — citim proiectul din DB
      const project = await projectRepository.findById(parseInt(projectId, 10));
      if (!project) {
        res.status(404).json({ error: 'Proiect negăsit.' });
        return;
      }

      const suggestion = await suggestRoomProgram({
        houseAreaSqm:     Number(houseAreaSqm),
        plotAreaSqm:      project.plotAreaSqm       ?? 300,
        houseStyle:       project.houseStyle         ?? 'Modern',
        totalFloors:      project.totalFloors        ?? 1,
        hasBasement:      project.hasBasement,
        streetOrientation: project.streetOrientation ?? 'S',
        familySize:       familySizeNum,
        budgetCategory:   budgetCategory as 'economic' | 'mediu' | 'premium',
        buildingPurpose:  project.buildingPurpose    ?? 'residential',
      });

      res.json(suggestion);
    } catch (e: any) {
      console.error('[aiController.suggestRooms] Eroare:', e);
      res.status(500).json({ error: e.message ?? 'Eroare internă.' });
    }
  },
};

