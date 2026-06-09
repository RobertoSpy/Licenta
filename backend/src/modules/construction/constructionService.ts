import fs from 'fs';
import path from 'path';
import { constructionRepository } from './constructionRepository';

export const constructionService = {
  async generatePhasesForProject(projectId: number) {
    const phasesPath = path.join(__dirname, '../../data/construction-phases.json');
    if (!fs.existsSync(phasesPath)) {
      throw new Error('MISSING_JSON_FILE');
    }

    let phasesJson;
    try {
      phasesJson = JSON.parse(fs.readFileSync(phasesPath, 'utf8'));
    } catch (err) {
      throw new Error('MALFORMED_JSON_FILE');
    }

    const phasesToInsert = phasesJson.map((p: any) => ({
      projectId,
      phaseOrder: p.order,
      name: p.name,
      description: p.description,
      durationDays: p.durationDays,
    }));

    await constructionRepository.deleteByProject(projectId);
    await constructionRepository.createMany(phasesToInsert);
    
    return constructionRepository.getByProject(projectId);
  },

  async getProjectPhases(projectId: number) {
    let phases = await constructionRepository.getByProject(projectId);
    if (phases.length === 0) {
      phases = await this.generatePhasesForProject(projectId);
    }
    return phases;
  },

  async completePhase(projectId: number, phaseOrder: number) {
    const phases = await constructionRepository.getByProject(projectId);
    const targetPhase = phases.find(p => p.phaseOrder === phaseOrder);
    
    if (!targetPhase) {
      throw new Error('PHASE_NOT_FOUND');
    }

    if (targetPhase.isCompleted) {
      return targetPhase; // Idempotent
    }

    if (phaseOrder > 1) {
      const prevPhase = phases.find(p => p.phaseOrder === phaseOrder - 1);
      if (!prevPhase || !prevPhase.isCompleted) {
        throw new Error('PREREQUISITE_NOT_COMPLETED');
      }
    }

    return constructionRepository.markPhaseCompleted(projectId, phaseOrder);
  }
};
