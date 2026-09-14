import api from './client';

export const catalogApi = {
  getByOrganization: (organizationId: string, type?: string, activeOnly?: boolean) =>
    api.get(`/catalog/${organizationId}`, { params: { type, activeOnly } }),

  getById: (id: string) => api.get(`/catalog/item/${id}`),

  create: (organizationId: string, data: any) =>
    api.post(`/catalog/${organizationId}`, data),

  update: (id: string, data: any) =>
    api.put(`/catalog/item/${id}`, data),

  delete: (id: string) => api.delete(`/catalog/item/${id}`),
};
