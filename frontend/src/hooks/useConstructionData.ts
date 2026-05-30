import { useState, useEffect, useCallback } from 'react';
import { apiPrivate } from '../api/axios';

export interface ConstructionPhase {
  id: number;
  projectId: number;
  phaseOrder: number;
  name: string;
  description: string;
  durationDays: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export function useConstructionData(projectId: string) {
  const [phases, setPhases] = useState<ConstructionPhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiPrivate.get(`/construction/${projectId}`);
      setPhases(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'A apărut o eroare necunoscută.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const markCompleted = async (phaseOrder: number) => {
    try {
      const response = await apiPrivate.patch(`/construction/${projectId}/phase/${phaseOrder}/complete`);
      const updatedPhase = response.data;
      setPhases(prev => prev.map(p => p.phaseOrder === updatedPhase.phaseOrder ? updatedPhase : p));
    } catch (err) {
      console.error(err);
      alert('Eroare la bifarea etapei');
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchPhases();
    }
  }, [projectId, fetchPhases]);

  return { phases, isLoading, error, refetch: fetchPhases, markCompleted };
}
