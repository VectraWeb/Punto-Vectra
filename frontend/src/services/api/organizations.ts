import api from './client';

export const organizationApi = {
  getAll: () => api.get('/organizations'),

  getById: (id: string) => api.get(`/organizations/${id}`),

  create: (data: any) => api.post('/organizations', data),

  update: (id: string, data: any) => api.put(`/organizations/${id}`, data),

  patch: (id: string, data: any) => api.patch(`/organizations/${id}`, data),
};
