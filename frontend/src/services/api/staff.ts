import api from './client';

export const staffApi = {
  getByOrganization: (organizationId: string) =>
    api.get(`/staff/${organizationId}`),

  create: (organizationId: string, data: any) =>
    api.post(`/staff/${organizationId}`, data),

  update: (id: string, data: any) =>
    api.put(`/staff/item/${id}`, data),

  delete: (id: string) => api.delete(`/staff/item/${id}`),
};
