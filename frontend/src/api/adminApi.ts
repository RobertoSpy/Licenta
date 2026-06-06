import { apiPrivate } from './axios';

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
}

export interface MaterialDTO {
  id: number;
  internalCode: string;
  name: string;
  category: string;
  subcategory: string;
  unit: string;
  pricePerUnit: number;
  storeUrl?: string;
  inStock: boolean;
}

export const adminApi = {
  // Users
  getUsers: async (): Promise<UserDTO[]> => {
    const res = await apiPrivate.get('/admin/users');
    return res.data.users;
  },

  // Materials
  getMaterials: async (): Promise<MaterialDTO[]> => {
    const res = await apiPrivate.get('/admin/materials');
    return res.data.materials;
  },

  updateMaterial: async (id: number, data: Partial<MaterialDTO>): Promise<MaterialDTO> => {
    const res = await apiPrivate.put(`/admin/materials/${id}`, data);
    return res.data.material;
  },

  deleteMaterial: async (id: number): Promise<void> => {
    await apiPrivate.delete(`/admin/materials/${id}`);
  },

  // Scraper Actions
  syncMaterials: async (): Promise<any> => {
    const res = await apiPrivate.post('/admin/scrape/sync');
    return res.data;
  },

  addMaterialFromUrl: async (data: any): Promise<any> => {
    const res = await apiPrivate.post('/admin/scrape/add', data);
    return res.data;
  },

  addMaterialManual: async (data: any): Promise<any> => {
    const res = await apiPrivate.post('/admin/materials/manual', data);
    return res.data;
  },

  uploadMaterialsCsv: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('csvFile', file);
    const res = await apiPrivate.post('/admin/materials/import-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // AI & RAG
  reseedNormatives: async (): Promise<any> => {
    const res = await apiPrivate.post('/admin/normatives/reseed');
    return res.data;
  }
};
