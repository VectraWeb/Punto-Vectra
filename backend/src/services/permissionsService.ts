export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  staff: 40,
  viewer: 20,
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'organization:read', 'organization:write', 'organization:delete',
    'branch:read', 'branch:write', 'branch:delete',
    'resource:read', 'resource:write', 'resource:delete',
    'reservation:read', 'reservation:write', 'reservation:cancel', 'reservation:status',
    'order:read', 'order:write', 'order:cancel', 'order:status',
    'catalog:read', 'catalog:write', 'catalog:delete',
    'customer:read', 'customer:write', 'customer:delete',
    'staff:read', 'staff:write', 'staff:delete',
    'config:read', 'config:write',
    'audit:read',
    'upload:write',
  ],
  admin: [
    'organization:read', 'organization:write',
    'branch:read', 'branch:write', 'branch:delete',
    'resource:read', 'resource:write', 'resource:delete',
    'reservation:read', 'reservation:write', 'reservation:cancel', 'reservation:status',
    'order:read', 'order:write', 'order:cancel', 'order:status',
    'catalog:read', 'catalog:write', 'catalog:delete',
    'customer:read', 'customer:write', 'customer:delete',
    'staff:read', 'staff:write', 'staff:delete',
    'config:read', 'config:write',
    'audit:read',
    'upload:write',
  ],
  manager: [
    'organization:read',
    'branch:read', 'branch:write',
    'resource:read', 'resource:write',
    'reservation:read', 'reservation:write', 'reservation:cancel', 'reservation:status',
    'order:read', 'order:write', 'order:cancel', 'order:status',
    'catalog:read', 'catalog:write',
    'customer:read', 'customer:write',
    'staff:read', 'staff:write',
    'config:read',
    'audit:read',
    'upload:write',
  ],
  staff: [
    'organization:read',
    'branch:read',
    'resource:read',
    'reservation:read', 'reservation:write', 'reservation:status',
    'order:read', 'order:write', 'order:status',
    'catalog:read',
    'customer:read', 'customer:write',
    'upload:write',
  ],
  viewer: [
    'organization:read',
    'branch:read',
    'resource:read',
    'reservation:read',
    'order:read',
    'catalog:read',
    'customer:read',
  ],
};

export function hasPermission(role: string, permission: string): boolean {
  const roleLevel = ROLE_HIERARCHY[role] ?? 0;
  if (roleLevel >= 100) return true; // owner has all permissions
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasMinRole(userRole: string, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= minLevel;
}
