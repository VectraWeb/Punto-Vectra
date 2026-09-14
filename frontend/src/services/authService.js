// authService.js — Autenticación mediante API REST.

import { authApi } from './api';

// ─── Login / Logout ──────────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  const { data } = await authApi.login(email, password);
  localStorage.setItem('token', data.token);
  return data.user;
}

export async function signOutUser() {
  await authApi.logout();
  localStorage.removeItem('token');
}

// ─── Registro de negocio ─────────────────────────────────────────────────────

export async function registerBusiness({
  email,
  password,
  businessType = 'restaurant',
  name,
  resourceLabel,
  resourcePlural,
  resourceCount = 3,
  capacity = 1,
}) {
  const { data } = await authApi.register({
    email,
    password,
    businessType,
    name,
    resourceLabel,
    resourcePlural,
    resourceCount,
    capacity,
  });
  localStorage.setItem('token', data.token);
  return { organizationId: data.user.organizationId, organization: data.organization, resources: [] };
}

export async function setupOrganizationForUser({
  uid,
  email,
  businessType = 'restaurant',
  name,
  resourceLabel,
  resourcePlural,
  resourceCount = 3,
  capacity = 1,
}) {
  const { data } = await authApi.register({
    email,
    password: 'temp-password-' + Date.now(),
    businessType,
    name,
    resourceLabel,
    resourcePlural,
    resourceCount,
    capacity,
  });
  return { organizationId: data.user.organizationId, organization: data.organization, resources: [] };
}

export async function claimDefaultOrganization(uid, email) {
  const { data } = await authApi.getMe();
  return { organizationId: data.user.organizationId, organization: data.organization };
}

export async function fetchUserOrganization(uid) {
  try {
    const { data } = await authApi.getMe();
    if (!data.organization) return null;
    return { organizationId: data.user.organizationId, organization: data.organization };
  } catch {
    return null;
  }
}

// ─── Auth availability check ────────────────────────────────────────────────
// In the new architecture, auth is always available via our backend
export async function isAuthAvailable() {
  return true;
}

export const AUTH_UNAVAILABLE_CODES = [];
