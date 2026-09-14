import api from './client';

export const resourceApi = {
  getByOrganization: (organizationId: string, type?: string) =>
    api.get(`/resources/${organizationId}`, { params: { type } }),

  getById: (organizationId: string, id: string) =>
    api.get(`/resources/${organizationId}/${id}`),

  create: (organizationId: string, data: any) =>
    api.post(`/resources/${organizationId}`, data),

  update: (organizationId: string, id: string, data: any) =>
    api.put(`/resources/${organizationId}/${id}`, data),

  delete: (organizationId: string, id: string) =>
    api.delete(`/resources/${organizationId}/${id}`),

  seed: (organizationId: string, resources: any[]) =>
    api.post(`/resources/${organizationId}/seed`, { resources }),
};
