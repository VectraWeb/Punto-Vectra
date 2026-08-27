// config/permissions.js — Roles y permisos configurables por organización.
// La seguridad real la impone Firestore (reglas + ownerUid); este módulo
// define la matriz de permisos por rol y la expone a la UI y los servicios.

export const ROLES = ['owner', 'admin', 'manager', 'employee', 'operator', 'viewer', 'customer'];

export const ROLE_LABELS = {
  owner: 'Dueño',
  admin: 'Administrador',
  manager: 'Encargado',
  employee: 'Empleado',
  operator: 'Operador',
  viewer: 'Solo lectura',
  customer: 'Cliente',
};

const ALL = { view: true, create: true, update: true, delete: true };
const VIEW = { view: true, create: false, update: false, delete: false };
const CRUD_NO_DELETE = { view: true, create: true, update: true, delete: false };

export const DEFAULT_PERMISSIONS = {
  owner: {
    organization: ALL,
    branches: ALL,
    employees: ALL,
    resources: ALL,
    catalog: ALL,
    reservations: ALL,
    orders: ALL,
    customers: ALL,
    payments: ALL,
    analytics: ALL,
    automations: ALL,
  },
  admin: {
    organization: CRUD_NO_DELETE,
    branches: ALL,
    employees: ALL,
    resources: ALL,
    catalog: ALL,
    reservations: ALL,
    orders: ALL,
    customers: ALL,
    payments: ALL,
    analytics: ALL,
    automations: CRUD_NO_DELETE,
  },
  manager: {
    organization: VIEW,
    branches: VIEW,
    employees: CRUD_NO_DELETE,
    resources: CRUD_NO_DELETE,
    catalog: CRUD_NO_DELETE,
    reservations: ALL,
    orders: ALL,
    customers: CRUD_NO_DELETE,
    payments: CRUD_NO_DELETE,
    analytics: VIEW,
    automations: VIEW,
  },
  employee: {
    organization: VIEW,
    branches: VIEW,
    employees: VIEW,
    resources: VIEW,
    catalog: VIEW,
    reservations: { view: true, create: true, update: true, delete: false },
    orders: { view: true, create: true, update: true, delete: false },
    customers: VIEW,
    payments: VIEW,
    analytics: VIEW,
    automations: VIEW,
  },
  operator: {
    organization: VIEW,
    branches: VIEW,
    employees: VIEW,
    resources: VIEW,
    catalog: VIEW,
    reservations: CRUD_NO_DELETE,
    orders: CRUD_NO_DELETE,
    customers: CRUD_NO_DELETE,
    payments: CRUD_NO_DELETE,
    analytics: VIEW,
    automations: VIEW,
  },
  viewer: {
    organization: VIEW,
    branches: VIEW,
    employees: VIEW,
    resources: VIEW,
    catalog: VIEW,
    reservations: VIEW,
    orders: VIEW,
    customers: VIEW,
    payments: VIEW,
    analytics: VIEW,
    automations: VIEW,
  },
  customer: {
    organization: VIEW,
    branches: VIEW,
    employees: { view: false, create: false, update: false, delete: false },
    resources: VIEW,
    catalog: VIEW,
    reservations: { view: false, create: true, update: false, delete: false },
    orders: { view: false, create: true, update: false, delete: false },
    customers: { view: false, create: false, update: false, delete: false },
    payments: VIEW,
    analytics: { view: false, create: false, update: false, delete: false },
    automations: { view: false, create: false, update: false, delete: false },
  },
};

export function permissionsOf(role) {
  return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.viewer;
}

/**
 * ¿El rol tiene permiso para una acción?
 * @param {string} role
 * @param {string} domain - ej: 'reservations'
 * @param {'view'|'create'|'update'|'delete'} action
 */
export function hasPermission(role, domain, action) {
  return Boolean(permissionsOf(role)?.[domain]?.[action]);
}

// Un owner no puede degradarse solo: evita que la organización quede sin dueño.
export function canChangeRole(actorRole, targetRole) {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole !== 'owner' && targetRole !== 'admin';
  return false;
}
