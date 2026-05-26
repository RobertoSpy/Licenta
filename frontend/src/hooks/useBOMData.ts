import { useState, useEffect, useCallback } from 'react';

export interface BOMItem {
  id: number;
  projectId: number;
  materialId: number;
  phase: string;
  formulaKey: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note: string;
  material: {
    name: string;
    unit: string;
    category: string;
    internalCode: string;
    uValue: number | null;
  };
}

export function useBOMData(projectId: string) {
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBOM = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bom/${projectId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Eroare la generarea/preluarea BOM-ului');
      }

      const data = await response.json();
      setBomItems(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'A apărut o eroare necunoscută.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchBOM();
    }
  }, [projectId, fetchBOM]);

  return { bomItems, isLoading, error, refetch: fetchBOM };
}
