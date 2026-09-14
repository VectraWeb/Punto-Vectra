import { describe, it, expect } from 'vitest';
import {
  ROLES, DEFAULT_PERMISSIONS, hasPermission, canChangeRole, permissionsOf,
} from './permissions.js';

describe('roles y permisos', () => {
  it('define los 7 roles base', () => {
    expect(ROLES).toEqual(['owner', 'admin', 'manager', 'employee', 'operator', 'viewer', 'customer']);
  });

  it('owner tiene acceso total', () => {
    expect(hasPermission('owner', 'reservations', 'delete')).toBe(true);
    expect(hasPermission('owner', 'payments', 'create')).toBe(true);
  });

  it('employee no puede eliminar reservas ni tocar catálogo', () => {
    expect(hasPermission('employee', 'reservations', 'create')).toBe(true);
    expect(hasPermission('employee', 'reservations', 'delete')).toBe(false);
    expect(hasPermission('employee', 'catalog', 'create')).toBe(false);
  });

  it('viewer es solo lectura', () => {
    expect(hasPermission('viewer', 'reservations', 'view')).toBe(true);
    expect(hasPermission('viewer', 'reservations', 'create')).toBe(false);
    expect(hasPermission('viewer', 'organization', 'update')).toBe(false);
  });

  it('customer solo crea sus propias reservas/pedidos', () => {
    expect(hasPermission('customer', 'reservations', 'create')).toBe(true);
    expect(hasPermission('customer', 'reservations', 'view')).toBe(false);
    expect(hasPermission('customer', 'customers', 'view')).toBe(false);
  });

  it('rol desconocido cae a viewer', () => {
    expect(permissionsOf('superhero')).toEqual(DEFAULT_PERMISSIONS.viewer);
  });

  it('solo owner/admin pueden cambiar roles', () => {
    expect(canChangeRole('owner', 'admin')).toBe(true);
    expect(canChangeRole('admin', 'manager')).toBe(true);
    expect(canChangeRole('admin', 'owner')).toBe(false);
    expect(canChangeRole('manager', 'operator')).toBe(false);
  });
});
