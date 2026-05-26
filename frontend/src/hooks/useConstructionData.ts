import { useState, useEffect, useCallback } from 'react';

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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/construction/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Eroare la preluarea etapelor');
      }

      const data = await response.json();
      setPhases(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'A apărut o eroare necunoscută.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const markCompleted = async (phaseOrder: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/construction/${projectId}/phase/${phaseOrder}/complete`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Nu s-a putut marca etapa');
      
      const updatedPhase = await response.json();
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
