import { Request, Response } from 'express';
import { editorService } from './editorService';
import { agentOrchestrator } from '../ai/services/agentOrchestrator';
import { conformityService } from '../../core/services/conformityService';
import { suggestRoomProgram } from '../ai/services/agentOrchestrator';
import { projectRepository } from '../project/projectRepository';
import { calcHouseFootprint } from '../../core/services/layout/layoutUtils';
import { ConfiguratorRoom } from '../../core/services/layout/layoutTypes';
import { generateConfiguratorLayout as runPartitioner } from '../../core/services/layout/layoutPartitioner';

/**
 * POST /api/editor/snapshots
 * Body: { projectId, planJSON, label? }
 * Creare snapshot nou (auto-save sau manual Ctrl+S).
 */
export const createSnapshot = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.body.projectId);
    const { planJSON, floor, label } = req.body;

    if (isNaN(projectId) || !planJSON) {
      res.status(400).json({ message: 'projectId valid și planJSON sunt obligatorii.' });
      return;
    }

    const validFloors = ['parter', 'etaj1'];
    const safeFloor = validFloors.includes(floor) ? floor : 'parter';

    const snapshot = await editorService.saveSnapshot(projectId, planJSON, safeFloor, label);
    res.status(201).json(snapshot);
  } catch (err) {
    console.error('[editorController] createSnapshot:', err);
    res.status(500).json({ message: 'Eroare la salvarea planului.' });
  }
};

/**
 * GET /api/editor/snapshots/:projectId
 * Lista ultimele 20 snapshot-uri (metadate, fără planJSON).
 */
export const listSnapshots = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) {
      res.status(400).json({ message: 'projectId invalid.' });
      return;
    }
    const floor = req.query.floor as string | undefined;
    const validFloors = ['parter', 'etaj1'];
    const safeFloor = floor && validFloors.includes(floor) ? floor as 'parter' | 'etaj1' : undefined;

    const snapshots = await editorService.listSnapshots(projectId, safeFloor);
    res.json(snapshots);
  } catch (err) {
    console.error('[editorController] listSnapshots:', err);
    res.status(500).json({ message: 'Eroare la încărcarea istoricului.' });
  }
};

/**
 * GET /api/editor/snapshots/single/:id
 * Conținut complet al unui snapshot (pentru restore).
 */
export const getSnapshot = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const snapshotId = parseInt(req.params.id as string);
    if (isNaN(snapshotId)) {
      res.status(400).json({ message: 'snapshotId invalid.' });
      return;
    }

    if (!(await editorService.verifySnapshotOwnership(snapshotId, userId))) {
      res.status(403).json({ message: 'Acces interzis.' });
      return;
    }

    const snapshot = await editorService.getSnapshot(snapshotId);
    if (!snapshot) {
      res.status(404).json({ message: 'Snapshot negăsit.' });
      return;
    }
    res.json(snapshot);
  } catch (err) {
    console.error('[editorController] getSnapshot:', err);
    res.status(500).json({ message: 'Eroare la încărcarea planului.' });
  }
};

/**
 * GET /api/editor/latest/:projectId
 * Cel mai recent snapshot — pentru inițializare editor.
 */
export const getLatestSnapshot = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) {
      res.status(400).json({ message: 'projectId invalid.' });
      return;
    }
    const floor = req.query.floor as string | undefined;
    const validFloors = ['parter', 'etaj1'];
    const safeFloor = floor && validFloors.includes(floor) ? floor as 'parter' | 'etaj1' : undefined;

    const snapshot = await editorService.getLatestSnapshot(projectId, safeFloor);
    res.json(snapshot ?? null);
  } catch (err) {
    console.error('[editorController] getLatestSnapshot:', err);
    res.status(500).json({ message: 'Eroare.' });
  }
};

/**
 * PATCH /api/editor/snapshots/:id/publish
 * Marchează snapshot ca versiune oficială → input Faza 3.
 */
export const publishSnapshot = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const snapshotId = parseInt(req.params.id as string);
    const projectId = parseInt(req.body.projectId as string);

    if (isNaN(snapshotId)) {
      res.status(400).json({ message: 'snapshotId invalid.' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ message: 'projectId este obligatoriu și trebuie să fie număr.' });
      return;
    }

    if (!(await editorService.verifySnapshotOwnership(snapshotId, userId, projectId))) {
      res.status(403).json({ message: 'Acces interzis sau snapshot-ul nu aparține acestui proiect.' });
      return;
    }

    const published = await editorService.publishSnapshot(snapshotId, projectId);
    res.json(published);
  } catch (error: any) {
    console.error('[EditorController] Eroare publishSnapshot:', error);
    res.status(500).json({ message: 'Eroare la publicare', details: error.message });
  }
};

export const publishLatestSnapshot = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    
    if (isNaN(projectId)) {
      res.status(400).json({ message: 'projectId este obligatoriu.' });
      return;
    }

    const latest = await editorService.getLatestSnapshot(projectId);
    if (!latest) {
      res.status(404).json({ message: 'Niciun snapshot găsit pentru a fi publicat.' });
      return;
    }

    const published = await editorService.publishSnapshot(latest.id, projectId);
    res.json(published);
  } catch (error: any) {
    console.error('[EditorController] Eroare publishLatestSnapshot:', error);
    res.status(500).json({ message: 'Eroare la publicare', details: error.message });
  }
};

/**
 * DELETE /api/editor/snapshots/:id
 * Ștergere snapshot cu verificare ownership.
 */
export const deleteSnapshot = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const snapshotId = parseInt(req.params.id as string);
    if (isNaN(snapshotId)) {
      res.status(400).json({ message: 'snapshotId invalid.' });
      return;
    }

    if (!(await editorService.verifySnapshotOwnership(snapshotId, userId))) {
      res.status(403).json({ message: 'Acces interzis.' });
      return;
    }

    await editorService.deleteSnapshot(snapshotId);
    res.json({ message: 'Snapshot șters.' });
  } catch (err) {
    console.error('[editorController] deleteSnapshot:', err);
    res.status(500).json({ message: 'Eroare la ștergerea snapshot-ului.' });
  }
};

/**
 * POST /api/editor/validate-conformity
 * Body: { rooms: [{ id, label?, usableSqm, widthM?, heightM? }], doors?: [{ id, widthM }] }
 * Response: { rooms, violations, warnings }
 */
export const validateConformity = async (req: Request, res: Response) => {
  try {
    const { rooms, doors, buildingPurpose } = req.body as {
      rooms?: Array<{ id: string; label?: string; usableSqm: number; widthM?: number; heightM?: number }>;
      doors?: Array<{ id: string; widthM: number }>;
      buildingPurpose?: string;
    };

    if (!rooms || !Array.isArray(rooms)) {
      res.status(400).json({ message: 'rooms este obligatoriu.' });
      return;
    }

    const results = await conformityService.evaluateRooms(rooms, { doors, buildingPurpose });
    res.json(results);
  } catch (err) {
    console.error('[editorController] validateConformity:', err);
    res.status(500).json({ message: 'Eroare la validarea conformității.' });
  }
};

/**
 * POST /api/editor/explain-conformity
 * Body: { violations: [{ label, usableSqm, minRequired }] }
 * Response: SSE stream cu explicație AI (RAG Legea 114/1996).
 */
export const explainConformity = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { violations } = req.body;

    if (!violations || !Array.isArray(violations) || violations.length === 0) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const violationsText = violations
      .map((v: any) => `- ${v.label}: ${v.usableSqm}mp (minim legal: ${v.minRequired}mp)`)
      .join('\n');

    const question = `Explică de ce Legea 114/1996 impune suprafețele minime pentru aceste camere:\n${violationsText}\nFii concis, citează articolele exacte.`;

    const stream = await agentOrchestrator.getAiStreamForChat(
      question,
      '', // fără context manual, agentul face RAG automat pe baza întrebării
      [],
      'editor'
    );

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[editorController] explainConformity:', err);
    res.write(`data: ${JSON.stringify({ text: '⚠️ Serviciul AI nu este disponibil momentan.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};

/**
 * POST /api/editor/generate-layout
 * Autogenerare plan 2D folosind Template Mapping + Squarified Treemap + Constraint Solver.
 */
export const generateLayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, totalFloorAreaSqm, style, familySize, shape } = req.body;
    
    if (!projectId || !totalFloorAreaSqm || !style || familySize === undefined) {
      res.status(400).json({ message: 'Date insuficiente pentru generare (necesar: projectId, totalFloorAreaSqm, style, familySize).' });
      return;
    }

    const project = await projectRepository.findById(parseInt(projectId, 10));
    if (!project) {
      res.status(404).json({ message: 'Proiect negăsit.' });
      return;
    }

    if (!project.streetOrientation || !project.plotAreaSqm || !project.totalFloors) {
      res.status(400).json({ 
        message: 'Completează orientarea față de stradă, suprafața terenului și regimul de înălțime din Faza 1 înainte de a genera planul.' 
      });
      return;
    }

    const familySizeNum = Math.max(1, parseInt(familySize, 10));

    // 1. AI Step (Creierul Creativ)
    const suggestion = await suggestRoomProgram({
        houseAreaSqm:     Number(totalFloorAreaSqm),
        plotAreaSqm:      project.plotAreaSqm,
        houseStyle:       String(style),
        totalFloors:      project.totalFloors,
        hasBasement:      project.hasBasement,
        streetOrientation: project.streetOrientation,
        familySize:       familySizeNum,
        budgetCategory:   (project.budgetCategory as 'economic' | 'mediu') || 'mediu', 
        buildingPurpose:  project.buildingPurpose    ?? 'residential',
    });

    // 2. Mapping Step (Traducătorul)
    const mappedRooms: ConfiguratorRoom[] = suggestion.rooms.map((r, i) => ({
      id: `ai-room-${i}`,
      type: r.type,
      label: r.label,
      ratioValue: r.weightRatio,
      minSqm: r.minSqm,
      maxSqm: r.maxSqm,
      zone: r.zone,
      naturalLight: r.naturalLight,
      isCirculation: r.isCirculation,
      hasStaircase: r.hasStaircase,
      hasDoorTo: r.hasDoorTo,
      mustAdjacentTo: r.mustAdjacentTo,
      orientation: r.orientation
    }));

    // 3. Mathematic Step (Șeful de Șantier)
    const footprint = calcHouseFootprint(Number(totalFloorAreaSqm), shape);
    const dimensions = { widthM: footprint.widthM, heightM: footprint.heightM };
    
    const elements = runPartitioner(shape, dimensions, mappedRooms, project.streetOrientation);

    res.json({ elements });
  } catch (error: any) {
    console.error('[EditorController] Eroare autogenerare layout AI:', error);
    res.status(500).json({ message: 'Eroare la generarea planului AI', details: error.message });
  }
};

/**
 * POST /api/editor/generate-configurator-layout
 * API port from frontend layoutPartitioner.ts
 */
export const generateConfiguratorLayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shape, dimensions, rooms, streetOrientation } = req.body;
    
    if (!shape || !dimensions || !rooms || !streetOrientation) {
      res.status(400).json({ message: 'shape, dimensions, rooms și streetOrientation sunt obligatorii.' });
      return;
    }

    const elements = runPartitioner(shape, dimensions, rooms, streetOrientation);

    res.json({ elements });
  } catch (error: any) {
    console.error('[EditorController] Eroare layout partitioner:', error);
    res.status(500).json({ message: 'Eroare la generarea planului detaliat', details: error.message });
  }
};

