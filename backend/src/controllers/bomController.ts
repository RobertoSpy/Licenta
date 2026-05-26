import { Request, Response } from 'express';
import { bomService } from '../services/bomService';
import { prisma } from '../lib/prisma';
import { agentOrchestrator } from '../services/ai/agentOrchestrator';
import { bomPhaseProgressRepository, BomPhaseKey, BomPhaseState } from '../repositories/bomPhaseProgressRepository';
import { bomIntroCacheRepository } from '../repositories/bomIntroCacheRepository';
import { GoogleGenAI } from '@google/genai';

const BOM_PHASE_ORDER: BomPhaseKey[] = [
  'fundatie',
  'structura',
  'zidarie',
  'acoperis',
  'instalatii',
  'finisaje'
];

const BOM_PHASE_KEYWORDS: Record<BomPhaseKey, RegExp> = {
  fundatie: /fundati|fundare|radier|talpa|elevati|cota zero|soclu|izolare la sol/i,
  structura: /structur|stalp|stâlp|grinda|grindă|planseu|planșeu|armatura|armătur|beton armat/i,
  zidarie: /zidarie|zidărie|caramida|cărămid|bca|blocuri/i,
  acoperis: /acoperis|acoperiș|sarpanta|șarpant|invelitoare|învelitoare|tabla|țiglă/i,
  instalatii: /instalati|instalați|electri|sanitar|termic|ventil|clima/i,
  finisaje: /finisaj|tencuial|vopsea|pardoseala|gresie|faianta|faianță|parchet|tamplarie|tâmplărie/i,
};

const BOM_PHASE_LABELS: Record<BomPhaseKey, string> = {
  fundatie: 'Fundație',
  structura: 'Structură',
  zidarie: 'Zidărie',
  acoperis: 'Acoperiș',
  instalatii: 'Instalații',
  finisaje: 'Finisaje',
};


const CONFIRMATION_PATTERNS = /\b(da|ok|bine|perfect|clar|inteleg|înțeleg|am inteles|am înțeles|sigur|confirm)\b/i;

const INTRO_CACHE_MAX_AGE_DAYS = 30;

// Lazy init — același pattern ca în aiController
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

function detectPhaseFromMessage(message: string): BomPhaseKey | null {
  const msg = message.toLowerCase();
  for (const phase of BOM_PHASE_ORDER) {
    if (BOM_PHASE_KEYWORDS[phase].test(msg)) return phase;
  }
  return null;
}

function phaseOrder(phase: BomPhaseKey): number {
  return BOM_PHASE_ORDER.indexOf(phase);
}

function isConfirmationMessage(message: string): boolean {
  return CONFIRMATION_PATTERNS.test(message.trim());
}

async function loadPhaseState(projectId: number): Promise<BomPhaseState> {
  const record = await bomPhaseProgressRepository.getByProject(projectId);
  if (!record) return { activePhase: 'fundatie', completedPhases: [] };

  const activePhase = BOM_PHASE_ORDER.includes(record.activePhase as BomPhaseKey)
    ? (record.activePhase as BomPhaseKey)
    : 'fundatie';
  const completedPhases = Array.isArray(record.completedPhases)
    ? record.completedPhases.filter((p): p is BomPhaseKey => BOM_PHASE_ORDER.includes(p as BomPhaseKey))
    : [];

  return { activePhase, completedPhases };
}

async function savePhaseState(projectId: number, state: BomPhaseState): Promise<void> {
  await bomPhaseProgressRepository.upsert(projectId, state);
}

async function classifyPhaseWithAI(message: string): Promise<BomPhaseKey | null> {
  const prompt = `Clasifică mesajul în una dintre fazele: fundatie, structura, zidarie, acoperis, instalatii, finisaje.
Răspunde strict JSON: {"phase":"fundatie"} sau {"phase":"none"}.
Mesaj: "${message}"`;

  try {
    const result = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: 40, temperature: 0 }
    });
    const text = result.text ?? '';
    const match = text.match(/\{\s*"phase"\s*:\s*"(.*?)"\s*\}/i);
    const phase = match?.[1]?.toLowerCase();
    if (!phase || phase === 'none') return null;
    return BOM_PHASE_ORDER.includes(phase as BomPhaseKey) ? (phase as BomPhaseKey) : null;
  } catch {
    return null;
  }
}

function formatIntroFallback(project: {
  county?: string | null;
  locality?: string | null;
  seismicZone?: string | null;
  frostDepthCm?: number | null;
  soilType?: string | null;
}) {
  const parts = [
    project.county ? `proiectul tau este in judetul ${project.county}` : null,
    project.locality ? `localitatea ${project.locality}` : null,
    project.seismicZone ? `zona seismica ${project.seismicZone}` : null,
    project.frostDepthCm ? `adancime de inghet ${project.frostDepthCm} cm` : null,
    project.soilType ? `sol ${project.soilType}` : null,
  ].filter(Boolean);

  const context = parts.length > 0 ? `Am vazut ca ${parts.join(', ')}.` : 'Am vazut datele de baza ale proiectului tau.';
  return `${context} Vom parcurge impreuna cele 6 etape ale constructiei, incepand cu fundatia. Vrei sa incepem cu fundatia?`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const generateBOM = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }
    const bomItems = await bomService.calculateBOM(projectId);
    res.json(bomItems);
  } catch (error: any) {
    console.error('[BOMController] Eroare la generarea BOM-ului:', error);
    res.status(500).json({ error: error.message || 'Eroare la generarea BOM-ului' });
  }
};

export const updateMaterialOverride = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }
    const { formulaKey, newMaterialCode } = req.body;
    if (!formulaKey || !newMaterialCode) {
      res.status(400).json({ error: 'Necesită formulaKey și newMaterialCode' });
      return;
    }
    const bomItems = await bomService.updateMaterialOverride(projectId, formulaKey, newMaterialCode);
    res.json(bomItems);
  } catch (error: any) {
    console.error('[BOMController] Eroare la suprascrierea materialului:', error);
    res.status(500).json({ error: error.message || 'Eroare la suprascrierea materialului' });
  }
};

/**
 * GET /api/bom/:projectId/intro
 * Mesaj introductiv non-streaming pentru chat-ul BOM.
 */
export const getBOMIntro = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        county: true,
        locality: true,
        seismicZone: true,
        frostDepthCm: true,
        soilType: true,
        buildingPurpose: true,
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit' });
      return;
    }

    const cached = await bomIntroCacheRepository.getByProject(projectId);
    if (cached) {
      const ageDays = Math.floor((Date.now() - new Date(cached.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays <= INTRO_CACHE_MAX_AGE_DAYS) {
        res.json({ text: cached.introText });
        return;
      }
    }

    const contextLines = [
      project.county      ? `Județ: ${project.county}` : null,
      project.locality    ? `Localitate: ${project.locality}` : null,
      project.seismicZone ? `Zonă seismică: ${project.seismicZone}` : null,
      project.frostDepthCm ? `Adâncime îngheț: ${project.frostDepthCm} cm` : null,
      project.soilType    ? `Tip sol: ${project.soilType}` : null,
      project.buildingPurpose ? `Destinație: ${project.buildingPurpose}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `Ești Zidario, mentorul tehnic al utilizatorului de-a lungul procesului de construcție.
Stilul tău: proactiv, educativ, empatic. Explici DE CE înainte de CE.
Scrie un mesaj introductiv de 4-6 propoziții pentru chat-ul BOM.
Include 1-2 observații despre contextul proiectului și încheie cu o întrebare care invită la dialog.
Nu folosi liste.

Date proiect:
${contextLines}

Etape construcție: Fundație, Structură, Zidărie, Acoperiș, Instalații, Finisaje.`;

    let introText = '';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await withTimeout(
          getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              maxOutputTokens: 220,
              temperature: 0.5
            }
          }),
          4500
        );
        introText = result.text ?? '';
        if (introText.trim().length > 0) break;
      } catch {
        // retry once
      }
    }

    if (!introText.trim()) {
      introText = formatIntroFallback(project);
    }

    await bomIntroCacheRepository.upsert(projectId, introText);
    res.json({ text: introText });
  } catch (error: any) {
    console.error('[BOMController.getBOMIntro] Eroare:', error);
    res.status(500).json({ error: 'Eroare la generarea mesajului introductiv' });
  }
};

/**
 * GET /api/bom/:projectId/phase-state
 * Starea curentă a tracker-ului BOM.
 */
export const getBOMPhaseState = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const state = await loadPhaseState(projectId);
    res.json(state);
  } catch (error: any) {
    console.error('[BOMController.getBOMPhaseState] Eroare:', error);
    res.status(500).json({ error: 'Eroare la citirea starii etapelor' });
  }
};

/**
 * POST /api/bom/:projectId/phase-state/confirm
 * Confirmă etapa curentă.
 */
export const confirmBOMPhase = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const state = await loadPhaseState(projectId);
    if (!state.completedPhases.includes(state.activePhase)) {
      state.completedPhases = [...state.completedPhases, state.activePhase];
      await savePhaseState(projectId, state);
    }

    res.json(state);
  } catch (error: any) {
    console.error('[BOMController.confirmBOMPhase] Eroare:', error);
    res.status(500).json({ error: 'Eroare la confirmarea etapei' });
  }
};

/**
 * POST /api/bom/:projectId/chat
 * Chat RAG conversațional pentru deviz — SSE Streaming.
 *
 * Deleghează la agentOrchestrator.getAiStreamForChat() cu:
 *   - screenContext: 'bom'  → SCREEN_AGENTS['bom'] = ['structural', 'materiale', 'deviz', 'energetic']
 *   - projectData din DB    → buildRAGContext() îl injectează ca date deterministe
 *
 * Zero logică duplicată — refolosește orchestratorul existent.
 */
export const bomAdvisorChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID proiect invalid' });
      return;
    }

    const { message, conversationHistory, historySummary } = req.body;
    if (!message) {
      res.status(400).json({ error: 'message este obligatoriu' });
      return;
    }

    // Citim datele proiectului din DB — context determinist
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        county: true, locality: true,
        seismicZone: true, frostDepthCm: true,
        soilType: true, buildingPurpose: true,
        totalFloors: true, totalFloorAreaSqm: true,
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit' });
      return;
    }

    // contextString — rezumat textual injectat direct în prompt de orchestrator
    const contextLines = [
      project.county            ? `Județ: ${project.county}`                              : null,
      project.locality          ? `Localitate: ${project.locality}`                        : null,
      project.seismicZone       ? `Zonă seismică: ${project.seismicZone}`                  : null,
      project.frostDepthCm      ? `Adâncime îngheț: ${project.frostDepthCm} cm`           : null,
      project.soilType          ? `Tip sol: ${project.soilType}`                           : null,
      project.totalFloors       ? `Niveluri: ${project.totalFloors}`                       : null,
      project.totalFloorAreaSqm ? `Suprafață planșee: ${project.totalFloorAreaSqm} mp`    : null,
    ].filter(Boolean);

    const contextString = contextLines.length > 0
      ? `Date proiect:\n${contextLines.join('\n')}`
      : 'Date proiect indisponibile.';

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Phase tracking + gating
    let phaseState = await loadPhaseState(projectId);
    let detectedPhase = detectPhaseFromMessage(message);
    const wantsConfirm = isConfirmationMessage(message);

    if (!detectedPhase && message.trim().length >= 12) {
      detectedPhase = await classifyPhaseWithAI(message);
    }

    if (wantsConfirm && !phaseState.completedPhases.includes(phaseState.activePhase)) {
      phaseState = {
        activePhase: phaseState.activePhase,
        completedPhases: [...phaseState.completedPhases, phaseState.activePhase]
      };
      await savePhaseState(projectId, phaseState);
    }

    if (detectedPhase) {
      const currentOrder = phaseOrder(phaseState.activePhase);
      const desiredOrder = phaseOrder(detectedPhase);
      const currentCompleted = phaseState.completedPhases.includes(phaseState.activePhase);

      if (desiredOrder > currentOrder && !currentCompleted) {
        // Blocăm avansarea până confirmă etapa curentă
        res.write('event: phase\n');
        res.write(`data: ${JSON.stringify({
          phase: phaseState.activePhase,
          completedPhases: phaseState.completedPhases
        })}\n\n`);
        res.write('event: message\n');
        res.write(`data: ${JSON.stringify({
          text: `Înainte să trecem mai departe, vreau să confirmăm etapa curentă (${BOM_PHASE_LABELS[phaseState.activePhase]}). Apasă „Confirmă etapa” sau scrie "confirm" dacă ai înțeles.`
        })}\n\n`);
        res.write('event: done\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      if (desiredOrder !== currentOrder && (currentCompleted || desiredOrder <= currentOrder)) {
        phaseState = {
          ...phaseState,
          activePhase: detectedPhase
        };
        await savePhaseState(projectId, phaseState);
      }
    }

    // Emit phase state la începutul răspunsului
    res.write('event: phase\n');
    res.write(`data: ${JSON.stringify({
      phase: phaseState.activePhase,
      completedPhases: phaseState.completedPhases
    })}\n\n`);

    // Delegăm la orchestratorul existent — fără logică duplicată
    const stream = await agentOrchestrator.getAiStreamForChat(
      message,
      contextString,
      conversationHistory || [],
      'bom',           // → SCREEN_AGENTS['bom'] = ['structural', 'materiale', 'deviz', 'energetic']
      historySummary ?? null,
      {
        county:          project.county,
        locality:        project.locality,
        seismicZone:     project.seismicZone,
        frostDepthCm:    project.frostDepthCm,
        soilType:        project.soilType,
        buildingPurpose: project.buildingPurpose,
      }
    );

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write('event: message\n');
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('event: done\n');
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[BOMController.bomAdvisorChat] Eroare:', error);
    res.write(`data: ${JSON.stringify({ text: '\n[Eroare la conectarea cu Zidario AI.]' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
