import { useState, useEffect, useCallback } from 'react';
import { apiPrivate } from '../api/axios';

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
      const response = await apiPrivate.post(`/bom/${projectId}/generate`);
      setBomItems(response.data);
    } catch (err: any) {
      console.error(err);
      let msg = 'Eroare la generarea BOM-ului.';
      if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
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
