import api from './client';

export const branchApi = {
  getByOrganization: (organizationId: string) =>
    api.get(`/branches/${organizationId}`),

  create: (organizationId: string, data: any) =>
    api.post(`/branches/${organizationId}`, data),

  delete: (organizationId: string, branchId: string) =>
    api.delete(`/branches/${organizationId}/${branchId}`),
};
