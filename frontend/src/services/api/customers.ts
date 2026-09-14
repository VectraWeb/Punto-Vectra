import api from './client';

export const customerApi = {
  getByOrganization: (organizationId: string) =>
    api.get(`/customers/${organizationId}`),

  getById: (id: string) => api.get(`/customers/item/${id}`),

  getOrCreate: (data: {
    organizationId: string;
    branchId?: string;
    phone: string;
    name?: string;
    email?: string;
  }) => api.post('/customers/get-or-create', data),

  update: (id: string, data: any) =>
    api.put(`/customers/item/${id}`, data),

  delete: (id: string) => api.delete(`/customers/item/${id}`),
};
