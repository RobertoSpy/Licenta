import { apiPrivate } from './axios';
import type { ContractorProfile } from './contractorApi';

export interface QuoteRequestPayload {
  projectId: number;
  contractorIds: number[];
  message?: string;
}

export interface Quote {
  id: number;
  contractorId: number;
  projectId: number;
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';
  totalAmount: number | null;
  executionDays: number | null;
  message: string | null;
  acceptsBOM: boolean;
  bomVariations: any | null;
  createdAt: string;
  updatedAt: string;
  contractor?: ContractorProfile;
  project?: any; // Puteți tipiza mai specific
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
  getContractorQuotes: async (): Promise<Quote[]> => {
    const { data } = await apiPrivate.get('/quotes/contractor');
    return data;
  },

  submitQuote: async (quoteId: number, payload: { totalAmount: number, executionDays: number, message?: string, acceptsBOM: boolean, bomVariations?: any }): Promise<Quote> => {
    const { data } = await apiPrivate.post(`/quotes/${quoteId}/submit`, payload);
    return data;
  }
};
