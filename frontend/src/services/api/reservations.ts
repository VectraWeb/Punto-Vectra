import api from './client';

export const reservationApi = {
  getAll: (params?: { organizationId?: string; date?: string; service?: string }) =>
    api.get('/reservations', { params }),

  getById: (id: string) => api.get(`/reservations/${id}`),

  create: (data: any) => api.post('/reservations', data),

  update: (id: string, data: any) => api.put(`/reservations/${id}`, data),

  updateStatus: (id: string, status: string, estado?: string) =>
    api.patch(`/reservations/${id}/status`, { status, estado }),

  delete: (id: string) => api.delete(`/reservations/${id}`),

  cancel: (id: string, motivo?: string) =>
    api.post(`/reservations/${id}/cancel`, { motivo }),

  checkAvailability: (data: any) =>
    api.post('/reservations/check-availability', data),

  getAnalytics: (organizationId: string, dates: string[]) =>
    api.post('/reservations/analytics', { organizationId, dates }),
};
