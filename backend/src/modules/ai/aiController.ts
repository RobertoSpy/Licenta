import { Request, Response } from 'express';
import { agentOrchestrator, suggestRoomProgram } from './services/agentOrchestrator';
import { chatSummaryRepository } from './chatSummaryRepository';
import { projectRepository } from '../project/projectRepository';
import { GoogleGenAI } from '@google/genai';
import { searchHybrid } from './services/ragService';
import { FALLBACK_MODELS_CHAT } from './services/aiClient';

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
    // Supports both:
    //   - POST with body { projectId, currentMaterialCode, alternativeMaterialCode }  (new, full-context)
    //   - GET with query ?base=x&alt=y  (legacy fallback, minimal context)
    const isPost = req.method === 'POST';

    try {
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

      let prompt: string;

      if (isPost) {
        const { projectId, currentMaterialCode, alternativeMaterialCode } = req.body;
        if (!projectId || !currentMaterialCode || !alternativeMaterialCode) {
          res.write(`data: ${JSON.stringify({ text: '[Eroare: lipsă projectId, currentMaterialCode sau alternativeMaterialCode.]' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        const { prisma } = await import('../../lib/prisma');

        const [project, currentMat, altMat, bomItems] = await Promise.all([
          prisma.project.findUnique({
            where: { id: Number(projectId) },
            select: {
              county: true, locality: true, seismicZone: true,
              frostDepthCm: true, soilType: true, houseStyle: true,
              totalFloors: true, buildingPurpose: true,
              chatSummaries: true,
              planSnapshots: {
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            },
          }),
          prisma.material.findUnique({ where: { internalCode: currentMaterialCode } }),
          prisma.material.findUnique({ where: { internalCode: alternativeMaterialCode } }),
          prisma.projectBOM.findMany({
            where: { projectId: Number(projectId) },
            include: { material: { select: { name: true, category: true, internalCode: true } } },
          }),
        ]);

        if (!project || !currentMat || !altMat) {
          res.write(`data: ${JSON.stringify({ text: '[Eroare: Proiect sau material negăsit în baza de date.]' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        // BOM summary by phase
        const byPhase = bomItems.reduce((acc: Record<string, number>, item: any) => {
          acc[item.phase] = (acc[item.phase] || 0) + item.totalPrice;
          return acc;
        }, {});
        const bomSummary = Object.entries(byPhase)
          .map(([phase, total]) => `  - ${phase}: ${(total as number).toLocaleString('ro-RO')} RON`)
          .join('\n');

        // Financial impact
        const currentBOMItem = bomItems.find((b: any) => b.material.internalCode === currentMaterialCode);
        let financialImpactBlock = '';
        if (currentBOMItem) {
          const costCurrent = currentBOMItem.totalPrice;
          const costAlt = currentBOMItem.quantity * altMat.pricePerUnit;
          const delta = costAlt - costCurrent;
          financialImpactBlock = `
IMPACT FINANCIAR CALCULAT DIN DEVIZ:
- Cantitate necesară proiect: ${currentBOMItem.quantity} ${currentMat.unit}
- Cost actual (${currentMat.name}): ${costCurrent.toLocaleString('ro-RO')} RON
- Cost alternativă (${altMat.name}): ${costAlt.toLocaleString('ro-RO')} RON
- Diferență: ${delta >= 0 ? '+' : ''}${delta.toLocaleString('ro-RO')} RON (${delta >= 0 ? 'mai scump' : 'economie'})`;
        }

        prompt = `Ești Zidario, consultant tehnic pentru construcții rezidențiale românești.

CONTEXT AMPLASAMENT:
- Județ: ${project.county ?? 'nespecificat'}, Localitate: ${project.locality ?? 'nespecificat'}
- Zonă seismică: ${project.seismicZone ?? 'necunoscută'} (P100-1/2013)
- Adâncime îngheț: ${project.frostDepthCm ?? '?'}cm (NP112-2014)
- Tip sol: ${project.soilType ?? 'necunoscut'}
- Stil casă: ${project.houseStyle ?? 'nespecificat'}, ${project.totalFloors ?? 1} etaje
- Destinație: ${project.buildingPurpose ?? 'rezidențial'}

ISTORIC CONVERSAȚII ȘI PREFERINȚE UTILIZATOR:
${(project as any).chatSummaries?.map((s: any) => `- ${s.phase}: ${s.summary}`).join('\n') || 'Niciun rezumat disponibil.'}

METRICI PLAN 2D:
${(project as any).planSnapshots?.[0] ? `- Perimetru: ${(project as any).planSnapshots[0].planJSON?.metrics?.perimeterM || '?'}m\n- Suprafață utilă aprox: ${(project as any).planSnapshots[0].planJSON?.metrics?.totalFloorAreaSqm || '?'}mp\n- Număr uși/ferestre extrase din plan: Da` : 'Niciun plan 2D salvat.'}


MATERIAL CURENT ÎN DEVIZ:
- Cod: ${currentMat.internalCode}
- Nume: ${currentMat.name}
- Categorie: ${currentMat.category} / ${currentMat.subcategory ?? '-'}
- Preț: ${currentMat.pricePerUnit} RON/${currentMat.unit}
- U-value: ${currentMat.uValue ?? 'nespecificat'} W/m²K
- Descriere: ${currentMat.description ?? '-'}

ALTERNATIVĂ PROPUSĂ:
- Cod: ${altMat.internalCode}
- Nume: ${altMat.name}
- Categorie: ${altMat.category} / ${altMat.subcategory ?? '-'}
- Preț: ${altMat.pricePerUnit} RON/${altMat.unit}
- U-value: ${altMat.uValue ?? 'nespecificat'} W/m²K
- Descriere: ${altMat.description ?? '-'}

DEVIZ COMPLET PE FAZE (materiale deja selectate):
${bomSummary || '  (deviz gol)'}
${financialImpactBlock}

SARCINI (răspunde structurat, maxim 200 cuvinte, în română):
1. ✅/❌ COMPATIBILITATE: Este alternativa compatibilă cu zona seismică ${project.seismicZone ?? '?'} și solul ${project.soilType ?? '?'}?
2. 🔧 COMPATIBILITATE MATERIALE: Se potrivește cu celelalte materiale alese în deviz?
3. 🌡️ IMPACT ENERGETIC: Cum afectează clasa energetică? (compară U-values dacă disponibile)
4. 💰 VERDICT FINANCIAR: Merită diferența de preț pentru acest proiect specific?
5. 📋 NORMATIVE: Citează articolul exact dacă există restricții (CR6-2013, NE012-1:2022, Mc-001-2022, P100-1/2013).

IMPORTANT: Dacă alternativa este incompatibilă cu zona seismică sau solul, spune NU clar și motivează.`;

      } else {
        // Legacy GET path — minimal context
        const base = req.query.base as string;
        const alt = req.query.alt as string;
        if (!base || !alt) {
          res.write(`data: ${JSON.stringify({ text: '[Eroare: parametri lipsă]' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        prompt = `Ești Zidario AI, expert în normative de construcții românești.
Explică pe scurt de ce un client ar trebui să aleagă "${alt}" în loc de "${base}".
Include doar aspecte tehnice și normative relevante (CR6-2013, NE012, Mc-001-2022).
Max 120 cuvinte. Fii direct și profesionist.`;
      }

      // RAG context
      const question = prompt.substring(0, 300);
      const structuralChunks = await searchHybrid(question, 'structural', 3, undefined, 'residential');
      const energeticChunks = await searchHybrid(question, 'energetic', 2, undefined, 'residential');
      const combinedChunks = [...structuralChunks, ...energeticChunks];

      if (combinedChunks.length === 0) {
        res.write(`data: ${JSON.stringify({ meta: { noSources: true } })}\n\n`);
      } else {
        const ragContext = combinedChunks.map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`).join('\n\n');
        prompt = `SURSE NORMATIVE INDEXATE (RAG):\n${ragContext}\n\n---\n\n${prompt}`;
      }

      let stream: any = null;
      let lastError: any = null;
      for (const modelName of FALLBACK_MODELS_CHAT) {
        try {
          stream = await getAi().models.generateContentStream({
            model: modelName,
            contents: prompt,
            config: { maxOutputTokens: 1500, temperature: 0.2 }
          });
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[explainMaterial] Eroare cu ${modelName}: ${e?.message?.substring(0, 80)}`);
        }
      }
      if (!stream) throw new Error('Serviciul este momentan indisponibil.');

      for await (const chunk of stream) {
        if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
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


  async explainMaterialById(req: Request, res: Response): Promise<void> {
    try {
      const materialId = parseInt(req.params.materialId as string, 10);
      if (isNaN(materialId)) {
        res.status(400).json({ error: 'ID material invalid' });
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
      const { prisma } = await import('../../lib/prisma');
      const material: any = await prisma.material.findUnique({
        where: { id: materialId },
        include: { chunks: true } as any
      });

      if (!material) {
        res.write(`data: ${JSON.stringify({ text: 'Materialul nu a fost găsit în baza de date.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      let specs = material.description || '';
      if (material.chunks && material.chunks.length > 0) {
        specs += '\n\n' + material.chunks.map((c: any) => c.content).join('\n');
      }

      const prompt = `Ești Zidario AI, un expert tehnic în materiale de construcții.
Oferă o explicație scurtă și pur tehnică (max 80 cuvinte) pentru beneficiile utilizării materialului "${material.name}" într-un proiect de construcție rezidențială.
Folosește următoarele date tehnice disponibile:
${specs}

Nu folosi un ton de marketing, ci unul strict ingineresc (izolație termică, rezistență, compresiune, fonoizolație, utilitate). Nu saluta.`;

      let stream: any = null;
      let lastError: any = null;
      
      for (const modelName of FALLBACK_MODELS_CHAT) {
        try {
          stream = await getAi().models.generateContentStream({
            model: modelName,
            contents: prompt
          });
          break;
        } catch (e: any) {
          lastError = e;
          const is503 = e?.status === 503 || String(e?.message).includes('503') || String(e?.message).toLowerCase().includes('high demand');
          if (is503) continue;
          break;
        }
      }
      
      if (!stream) {
        throw new Error('Modelele sunt indisponibile.');
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
      console.error('[aiController.explainMaterialById] Eroare:', e);
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

      let result: any = null;
      let lastError: any = null;

      for (const modelName of FALLBACK_MODELS_CHAT) {
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

      const validBudgets = ['economic', 'mediu'];
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
        budgetCategory:   budgetCategory as 'economic' | 'mediu',
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
    const question = `Conformitate normativă pentru înlocuire material: "${originalMaterialName}" -> "${newMaterialName}" pentru etapa ${formulaKey}.`;
    const structuralChunks = await searchHybrid(question, 'structural', 3, undefined, 'residential');
    const energeticChunks = await searchHybrid(question, 'energetic', 2, undefined, 'residential');
    const combinedChunks = [...structuralChunks, ...energeticChunks];

    if (combinedChunks.length === 0) {
      res.write(`data: ${JSON.stringify({ meta: { noSources: true } })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: '⚠️ Atenție: Nu există surse normative indexate pentru această înlocuire. Verificați manual normativele aplicabile.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const ragContext = combinedChunks
      .map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`)
      .join('\n\n');

    const contextBlock = projectContext
      ? `\nContextul proiectului:\n${projectContext}\n`
      : '';

    const prompt = `Ești Zidario AI, expert în inginerie civilă și normative de construcții românești.
${contextBlock}
Foloseste EXCLUSIV sursele de mai jos. Dacă nu e suficientă informația, răspunde cu "⚠️ Atenție".

SURSE NORMATIVE (RAG):
${ragContext}

Utilizatorul vrea să înlocuiască materialul original cu unul alternativ în cadrul etapei "${formulaKey}":
- Material original: "${originalMaterialName}"
- Material alternativ propus: "${newMaterialName}"

Verifică rapid dacă această înlocuire este conformă normativ (CR6-2013, NE012-1:2022, P100-1/2013, NP112-2014).
Răspunde CONCIS în maxim 80 de cuvinte. Structura răspunsului:
1. Primul cuvânt TREBUIE să fie exact: "✅ Conform" SAU "⚠️ Atenție" SAU "❌ Neconform"
2. Motivul tehnic scurt (1-2 propoziții cu referința normativă exactă)
3. Dacă e Neconform sau Atenție — indică ce trebuie să verifice beneficiarul

Nu inventa normative. Dacă nu știi cu certitudine, folosește "⚠️ Atenție".`;

    let stream: any = null;
    let lastError: any = null;
    
    for (const modelName of FALLBACK_MODELS_CHAT) {
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
