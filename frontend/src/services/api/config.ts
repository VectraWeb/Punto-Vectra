import api from './client';

export const configApi = {
  getById: (id: string) => api.get(`/config/${id}`),

  create: (id: string, data: any) => api.post(`/config/${id}`, data),

  update: (id: string, data: any) => api.put(`/config/${id}`, data),

  patch: (id: string, data: any) => api.patch(`/config/${id}`, data),
};
