import { apiPrivate } from './axios';
import type { ContractorProfile } from './contractorApi';

export interface QuoteRequestPayload {
  projectId: number;
  contractorIds: number[];
  message?: string;
  phaseIds?: number[];
}

export interface Quote {
  id: number;
  contractorId: number;
  projectId: number;
  phases?: any[];
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';
  totalAmount: number | null;
  executionDays: number | null;
  message: string | null;
  clientMessage?: string | null;
  acceptsBOM: boolean;
  bomVariations: any | null;
  createdAt: string;
  updatedAt: string;
  contractor?: ContractorProfile;
  project?: any;
  // phase?: any; - scos
}

export const quoteApi = {
  // --- CLIENȚI ---
  requestQuotes: async (payload: QuoteRequestPayload) => {
    const { data } = await apiPrivate.post('/quotes/request', payload);
    return data;
  },

  getClientQuotes: async (projectId: number): Promise<Quote[]> => {
    const { data } = await apiPrivate.get(`/quotes/project/${projectId}`);
    return data;
  },

  acceptQuote: async (quoteId: number): Promise<Quote> => {
    const { data } = await apiPrivate.post(`/quotes/${quoteId}/accept`);
    return data;
  },

  // --- CONSTRUCTORI ---
  getContractorQuotes: async (page: number = 1, limit: number = 20): Promise<any> => {
    const { data } = await apiPrivate.get('/quotes/contractor', { params: { page, limit } });
    return data;
  },

  submitQuote: async (quoteId: number | undefined, payload: { projectId?: number, selectedPhases?: number[], totalAmount: number, executionDays: number, message?: string, acceptsBOM: boolean, bomVariations?: any, selfInitiated?: boolean }): Promise<Quote> => {
    // Dacă e selfInitiated, folosim ruta /submit (fără ID)
    const url = quoteId ? `/quotes/${quoteId}/submit` : '/quotes/submit';
    const { data } = await apiPrivate.post(url, payload);
    return data;
  }
};
