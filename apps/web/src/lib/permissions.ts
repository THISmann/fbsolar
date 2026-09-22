export type StaffRole = 'ADMIN' | 'SUPER_ADMIN' | 'CONTENT_EDITOR' | 'CATALOG_MANAGER';
export type Role = StaffRole | 'USER';

export type Permission =
  | 'pages.write'
  | 'projects.write'
  | 'products.write'
  | 'contacts.read'
  | 'visits.read'
  | 'users.manage'
  | 'audit.read';

const STAFF: StaffRole[] = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'CATALOG_MANAGER'];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  ADMIN: [
    'pages.write',
    'projects.write',
    'products.write',
    'contacts.read',
    'visits.read',
    'users.manage',
    'audit.read',
  ],
  SUPER_ADMIN: [
    'pages.write',
    'projects.write',
    'products.write',
    'contacts.read',
    'visits.read',
    'users.manage',
    'audit.read',
  ],
  CONTENT_EDITOR: ['pages.write', 'projects.write'],
  CATALOG_MANAGER: ['products.write', 'contacts.read', 'visits.read'],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Super administrateur',
  SUPER_ADMIN: 'Super administrateur',
  CONTENT_EDITOR: 'Éditeur contenu',
  CATALOG_MANAGER: 'Gestionnaire catalogue',
};

export const ASSIGNABLE_ROLES: Array<Exclude<StaffRole, 'ADMIN'>> = [
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'CATALOG_MANAGER',
];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF as string[]).includes(role);
}

export function isSuperAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function permissionsFor(role: string): Permission[] {
  if (!isStaffRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return permissionsFor(role).includes(permission);
}
