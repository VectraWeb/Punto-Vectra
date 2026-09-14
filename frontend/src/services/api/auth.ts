import api from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: {
    email: string;
    password: string;
    businessType?: string;
    name: string;
    resourceLabel?: string;
    resourcePlural?: string;
    resourceCount?: number;
    capacity?: number;
  }) => api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),

  staffPin: (pin: string) => api.post('/auth/staff-pin', { pin }),
};
