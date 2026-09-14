import api from './client';

export const auditApi = {
  getByOrganization: (organizationId: string, limit?: number) =>
    api.get(`/audit/${organizationId}`, { params: { limit } }),

  create: (data: any) => api.post('/audit', data),
};
