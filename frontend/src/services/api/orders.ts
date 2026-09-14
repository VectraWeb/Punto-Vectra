import api from './client';

export const orderApi = {
  getAll: (params?: { organizationId?: string; date?: string; service?: string }) =>
    api.get('/orders', { params }),

  getById: (id: string) => api.get(`/orders/${id}`),

  create: (data: any) => api.post('/orders', data),

  updateStatus: (id: string, status: string, pedidoEstado?: string) =>
    api.patch(`/orders/${id}/status`, { status, pedidoEstado }),

  delete: (id: string) => api.delete(`/orders/${id}`),
};
