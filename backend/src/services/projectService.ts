import { projectRepository } from '../repositories/projectRepository';

export const projectService = {
  calculateTotalFloors(existing: any, input: any) {
    const b = input.hasBasement ?? existing.hasBasement;
    const g = input.hasGroundFloor ?? existing.hasGroundFloor;
    const u = input.upperFloorsCount ?? existing.upperFloorsCount;
    const m = input.hasMansard ?? existing.hasMansard;
    return (b ? 1 : 0) + (g ? 1 : 0) + (u || 0) + (m ? 1 : 0);
  },

  async createProject(userId: number, title: string) {
    return projectRepository.create({
      title,
      userId
    });
  },

  async getUserProjects(userId: number) {
    return projectRepository.findManyByUserId(userId);
  },

  async getProjectById(projectId: number, userId: number) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new Error('NOT_FOUND');
    }
    if (project.userId !== userId) {
      throw new Error('FORBIDDEN');
    }
    return project;
  },

  async updateProject(projectId: number, userId: number, inputData: any) {
    const existing = await projectRepository.findById(projectId);
    if (!existing) {
      throw new Error('NOT_FOUND');
    }
    if (existing.userId !== userId) {
      throw new Error('FORBIDDEN');
    }

    let totalFloors: number | undefined;
    if (inputData.hasBasement !== undefined || inputData.hasGroundFloor !== undefined || inputData.upperFloorsCount !== undefined || inputData.hasMansard !== undefined) {
      totalFloors = this.calculateTotalFloors(existing, inputData);
    }

    const isCompleted = inputData.wizardStep === 4 ? true : undefined;

    const data: Record<string, unknown> = {};
    const allowedKeys = [
      'title', 'wizardStep', 'lat', 'lng', 'polygonGeoJSON', 'county', 'locality', 
      'seismicZone', 'frostDepthCm', 'plotAreaSqm', 'soilType', 'slopePercent', 
      'streetOrientation', 'soilNotes', 'maxAllowedFloors', 'minFoundationDepthCm', 
      'zoningRestrictions', 'houseStyle', 'hasBasement', 'hasGroundFloor', 
      'upperFloorsCount', 'hasMansard'
    ];

    for (const key of allowedKeys) {
      if (inputData[key] !== undefined) {
        data[key] = inputData[key];
      }
    }

    if (totalFloors !== undefined) data.totalFloors = totalFloors;
    if (isCompleted !== undefined) data.isCompleted = isCompleted;

    return projectRepository.update(projectId, data);
  },

  async deleteProject(projectId: number, userId: number) {
    const existing = await projectRepository.findById(projectId);
    if (!existing || existing.userId !== userId) {
      throw new Error('FORBIDDEN_OR_NOT_FOUND');
    }
    await projectRepository.delete(projectId);
  }
};
