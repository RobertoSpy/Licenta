import { apiPrivate } from './axios';

export interface ContractorProfile {
  id: number;
  userId: number;
  companyName: string;
  cui: string | null;
  description: string | null;
  specializations: string[];
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
  };
}

export const contractorApi = {
  // Pentru clienți
  getContractors: async (county?: string, specializations?: string[]): Promise<ContractorProfile[]> => {
    const params = new URLSearchParams();
    if (county) params.append('county', county);
    if (specializations && specializations.length > 0) params.append('specializations', specializations.join(','));
    
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
