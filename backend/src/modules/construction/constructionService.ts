import fs from 'fs';
import path from 'path';
import { constructionRepository } from './constructionRepository';

export const constructionService = {
  async generatePhasesForProject(projectId: number) {
    const phasesPath = path.join(__dirname, '../../data/construction-phases.json');
    const phasesJson = JSON.parse(fs.readFileSync(phasesPath, 'utf8'));

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
    return constructionRepository.markPhaseCompleted(projectId, phaseOrder);
  }
};
