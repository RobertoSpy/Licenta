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

      const timeoutId = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ error: 'Timeout 90s: Procesarea a durat prea mult.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }, 90000);

      res.on('close', () => clearTimeout(timeoutId));

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

      clearTimeout(timeoutId);
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (e: any) {
      console.error('[aiController.chatStream] Eroare:', e);
      if (e?.status === 503 || String(e?.message).includes('503') || String(e?.message).includes('indisponibil')) {
        res.write(`data: ${JSON.stringify({ 
          error: 'Asistentul este momentan suprasolicitat. Încearcă din nou în 30 de secunde.' 
        })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Eroare internă de server.' })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  },

  async explainMaterial(req: Request, res: Response): Promise<void> {
    try {
      const base = req.query.base as string;
      const alt = req.query.alt as string;

      if (!base || !alt) {
        res.status(400).json({ error: 'base și alt sunt obligatorii' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const timeoutId = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ text: '\n[Eroare: Timeout 90s]' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }, 90000);

      res.on('close', () => clearTimeout(timeoutId));

      const prompt = `Ești Zidario AI, un expert în inginerie civilă și optimizare bugete construcții rezidențiale. Explică pe scurt de ce un client ar trebui să aleagă '${alt}' în loc de '${base}', referindu-te la normative tehnice (ex: CR 6-2013 pentru zidărie, NE012 etc.) și confort termic. Max 100 cuvinte. Fii direct și profesionist.`;

      // Simulam un call de RAG sau folosim modelul Gemini direct cu fallback
      const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      let stream: any = null;
      let lastError: any = null;
      
      for (const modelName of FALLBACK_MODELS) {
        try {
          stream = await getAi().models.generateContentStream({
            model: modelName,
            contents: prompt
          });
          break; // Succes, ieșim din buclă
        } catch (e: any) {
          lastError = e;
          const is503 = e?.status === 503 || String(e?.message).includes('503') || String(e?.message).toLowerCase().includes('high demand');
          if (is503) {
            console.warn(`[explainMaterial] 503 cu ${modelName}, încercăm următorul...`);
            continue;
          }
          console.warn(`[explainMaterial] Eroare cu ${modelName}, încercăm următorul... Motiv: ${e?.message?.substring(0, 100)}...`);
          continue; // Mergem la următorul model
        }
      }
      
      if (!stream) {
        console.error(`[explainMaterial] Toate modelele au eșuat. Ultima eroare:`, lastError?.message);
        throw new Error('Serviciul este momentan indisponibil.');
      }

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      clearTimeout(timeoutId);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e: any) {
      console.error('[aiController.explainMaterial] Eroare:', e);
      res.write(`data: ${JSON.stringify({ text: '\n[Eroare la generarea explicației.]' })}\n\n`);
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

      const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      let result: any = null;
      let lastError: any = null;

      for (const modelName of FALLBACK_MODELS) {
        try {
          result = await getAi().models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
              maxOutputTokens: 400,
              temperature: 0.3  // mai puțin creativ, mai determinist la rezumat
            }
          });
          break;
        } catch (e: any) {
          lastError = e;
          const is503 = e?.status === 503 || String(e?.message).includes('503') || String(e?.message).toLowerCase().includes('high demand');
          if (is503) {
            console.warn(`[summarizeConversation] 503 cu ${modelName}, încercăm următorul...`);
            continue;
          }
          console.warn(`[summarizeConversation] Eroare cu ${modelName}, încercăm următorul... Motiv: ${e?.message?.substring(0, 100)}...`);
          continue;
        }
      }

      if (!result) {
        console.error(`[summarizeConversation] Toate modelele au eșuat. Ultima eroare:`, lastError?.message);
        throw new Error('Serviciul este momentan indisponibil.');
      }

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

// ─────────────────────────────────────────────────────────────────
// EXPORT NAMED — validateMaterialOverride
//
// POST /api/ai/validate-override
// Verifică dacă înlocuirea unui material este conformă normativ.
// Returnează SSE cu verdict concis (Conform / Atenție / Neconform).
// ─────────────────────────────────────────────────────────────────

export async function validateMaterialOverride(req: Request, res: Response): Promise<void> {
  try {
    const {
      originalMaterialName,
      newMaterialName,
      formulaKey,
      projectContext,   // string deja formatat (seismicZone, soilType etc.)
    } = req.body;

    if (!originalMaterialName || !newMaterialName || !formulaKey) {
      res.status(400).json({ error: 'originalMaterialName, newMaterialName, formulaKey sunt obligatorii.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const timeoutId = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ text: '\n[Eroare: Timeout 90s]' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }, 90000);

    res.on('close', () => clearTimeout(timeoutId));

    // Construim un prompt concis + normativ
    const contextBlock = projectContext
      ? `\nContextul proiectului:\n${projectContext}\n`
      : '';

    const prompt = `Ești Zidario AI, expert în inginerie civilă și normative de construcții românești.
${contextBlock}
Utilizatorul vrea să înlocuiască materialul original cu unul alternativ în cadrul etapei "${formulaKey}":
- Material original: "${originalMaterialName}"
- Material alternativ propus: "${newMaterialName}"

Verifică rapid dacă această înlocuire este conformă normativ (CR6-2013, NE012-1:2022, P100-1/2013, NP112-2014).
Răspunde CONCIS în maxim 80 de cuvinte. Structura răspunsului:
1. Primul cuvânt TREBUIE să fie exact: "✅ Conform" SAU "⚠️ Atenție" SAU "❌ Neconform"
2. Motivul tehnic scurt (1-2 propoziții cu referința normativă exactă)
3. Dacă e Neconform sau Atenție — indică ce trebuie să verifice beneficiarul

Nu inventa normative. Dacă nu știi cu certitudine, folosește "⚠️ Atenție".`;

    const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let stream: any = null;
    let lastError: any = null;
    
    for (const modelName of FALLBACK_MODELS) {
      try {
        stream = await getAi().models.generateContentStream({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.2, maxOutputTokens: 200 },
        });
        break;
      } catch (e: any) {
        lastError = e;
        const is503 = e?.status === 503 || String(e?.message).includes('503') || String(e?.message).toLowerCase().includes('high demand');
        if (is503) {
          console.warn(`[validateMaterialOverride] 503 cu ${modelName}, încercăm următorul...`);
          continue;
        }
        console.warn(`[validateMaterialOverride] Eroare cu ${modelName}, încercăm următorul... Motiv: ${e?.message?.substring(0, 100)}...`);
        continue;
      }
    }
    
    if (!stream) {
      console.error(`[validateMaterialOverride] Toate modelele au eșuat. Ultima eroare:`, lastError?.message);
      throw new Error('Serviciul este momentan indisponibil.');
    }

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    clearTimeout(timeoutId);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e: any) {
    console.error('[validateMaterialOverride] Eroare:', e);
    res.write(`data: ${JSON.stringify({ text: '⚠️ Eroare la verificarea conformității. Verificați manual normativele aplicabile.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
