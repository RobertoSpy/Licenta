import { apiPrivate } from './axios';
import { ContractorSpecialization } from '../types/contractor';

export interface ContractorProfile {
  id: number;
  userId: number;
  companyName: string;
  cui: string | null;
  description: string | null;
  specializations: ContractorSpecialization[];
  county: string;
  coverageRadius: number;
  yearsExperience: number | null;
  completedProjects: number;
  avgRating: number;
  portfolioUrls: string[];
  certifications: string[];
  isVerified: boolean;
  isActive: boolean;
  user: {
    name: string | null;
    email: string;
    phone?: string;
  };
  reviews?: any[];
}

export const contractorApi = {
  // Pentru clienți
  getContractors: async (county?: string, specializations?: ContractorSpecialization[], page: number = 1, limit: number = 20): Promise<{ data: ContractorProfile[], pagination: { total: number, page: number, limit: number, totalPages: number } }> => {
    const params = new URLSearchParams();
    if (county) params.append('county', county);
    if (specializations && specializations.length > 0) params.append('specializations', specializations.join(','));
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    const { data } = await apiPrivate.get('/contractors', { params });
    return data;
  },

  getContractorById: async (id: number): Promise<ContractorProfile> => {
    const { data } = await apiPrivate.get(`/contractors/${id}`);
    return data;
  },

  // Pentru constructori
  getMyProfile: async (): Promise<ContractorProfile> => {
    const { data } = await apiPrivate.get('/contractors/me/profile');
    return data;
  },

  updateMyProfile: async (profileData: Partial<ContractorProfile>): Promise<ContractorProfile> => {
    const { data } = await apiPrivate.put('/contractors/me/profile', profileData);
    return data;
  },

  addReview: async (contractorId: number, projectId: number, rating: number, comment: string): Promise<any> => {
    const { data } = await apiPrivate.post(`/contractors/${contractorId}/reviews`, { projectId, rating, comment });
    return data;
  }
};
