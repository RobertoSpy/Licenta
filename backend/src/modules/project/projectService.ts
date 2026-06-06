import { projectRepository } from './projectRepository';
import * as turf from '@turf/turf';

export const projectService = {
  calculateTotalFloors(existing: any, input: any) {
    const g = input.hasGroundFloor ?? existing.hasGroundFloor;
    const u = input.upperFloorsCount ?? existing.upperFloorsCount;
    return (g ? 1 : 0) + (u || 0);
  },

  async createProject(userId: number, title: string) {
    return projectRepository.create({ title, userId });
  },

  async getUserProjects(userId: number) {
    return projectRepository.findManyByUserId(userId);
  },


  /**
   * Actualizează proiectul după ID.
   * Ownership-ul este deja verificat de tenantGuard înainte de apelul acestei metode.
   */
  async updateProject(projectId: number, inputData: any) {
    const existing = await projectRepository.findById(projectId);
    if (!existing) throw new Error('NOT_FOUND');

    let totalFloors: number | undefined;
    if (
      inputData.hasGroundFloor !== undefined ||
      inputData.upperFloorsCount !== undefined ||
      inputData.hasBasement !== undefined
    ) {
      totalFloors = this.calculateTotalFloors(existing, inputData);
    }

    const isCompleted = inputData.wizardStep === 4 ? true : undefined;

    const data: Record<string, unknown> = {};
    const allowedKeys = [
      'title', 'wizardStep', 'lat', 'lng', 'polygonGeoJSON', 'county', 'locality',
      'seismicZone', 'frostDepthCm', 'plotAreaSqm', 'soilType', 'slopePercent',
      'streetOrientation', 'soilNotes', 'maxAllowedFloors', 'minFoundationDepthCm',
      'zoningRestrictions', 'houseStyle', 'hasBasement', 'hasGroundFloor',
      'upperFloorsCount'
    ];

    for (const key of allowedKeys) {
      if (inputData[key] !== undefined) {
        data[key] = inputData[key];
      }
    }

    if (totalFloors !== undefined) data.totalFloors = totalFloors;
    if (isCompleted !== undefined) data.isCompleted = isCompleted;

    if (inputData.polygonLatLngs && Array.isArray(inputData.polygonLatLngs) && inputData.polygonLatLngs.length >= 3) {
      try {
        const coords = inputData.polygonLatLngs.map((p: any) => [p[1], p[0]]); // GeoJSON wants [lng, lat]
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]); // Close the linear ring
        }
        const poly = turf.polygon([coords]);
        data.polygonGeoJSON = poly.geometry;
        data.plotAreaSqm = turf.area(poly);
      } catch (e) {
        console.error('Eroare generare poligon/arie:', e);
      }
    }

    return projectRepository.update(projectId, data);
  },

  /**
   * Șterge proiectul după ID.
   * Ownership-ul este deja verificat de tenantGuard înainte de apelul acestei metode.
   */
  async deleteProject(projectId: number) {
    await projectRepository.delete(projectId);
  }
};
