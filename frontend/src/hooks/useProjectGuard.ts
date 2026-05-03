import { useState, useEffect } from 'react';
import { api } from '../api/axios';
import type { ProjectFormData } from '../components/wizard/ProjectWizard';

export const useProjectGuard = () => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restoredData, setRestoredData] = useState<Partial<ProjectFormData> | null>(null);
  const [restoredStep, setRestoredStep] = useState<number | null>(null);

  useEffect(() => {
    const initializeProject = async () => {
      try {
        const savedId = localStorage.getItem('activeProjectId');
        
        if (savedId) {
          const id = parseInt(savedId);
          const { data: project } = await api.get(`/api/projects/${id}`);
          
          if (project) {
            setProjectId(project.id);
            setRestoredStep(project.wizardStep || 1);
            // Mapăm TOATE câmpurile DB → ProjectFormData pentru resume corect
            setRestoredData({
              title: project.title,
              lat: project.lat,
              lng: project.lng,
              county: project.county,
              locality: project.locality,
              seismicZone: project.seismicZone,
              frostDepthCm: project.frostDepthCm,
              // Screen 2
              soilType: project.soilType ?? 'Nu știu',
              slopePercent: project.slopePercent ?? 0,
              streetOrientation: project.streetOrientation ?? 'N',
              // Screen 3
              maxAllowedFloors: project.maxAllowedFloors,
              minFoundationDepthCm: project.minFoundationDepthCm,
              // Screen 4
              houseStyle: project.houseStyle ?? 'Modern',
              hasBasement: project.hasBasement ?? false,
              hasGroundFloor: project.hasGroundFloor ?? true,
              upperFloorsCount: project.upperFloorsCount ?? 0,
              hasMansard: project.hasMansard ?? false,
            });
            setIsLoading(false);
            return;
          }
        }
        
        // Dacă nu avem ID salvat, creăm un proiect nou
        const { data: newProject } = await api.post('/api/projects');
        setProjectId(newProject.id);
        localStorage.setItem('activeProjectId', newProject.id.toString());

      } catch (err) {
        console.error("Eroare în ProjectGuard:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeProject();
  }, []);

  const clearProject = () => {
    localStorage.removeItem('activeProjectId');
    setProjectId(null);
  };

  return { projectId, isLoading, restoredData, restoredStep, clearProject };
};

