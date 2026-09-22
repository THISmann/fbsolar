/** Staff roles that can access /admin (not public USER). */
export const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'CATALOG_MANAGER'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserRole = 'USER' | StaffRole;

export type Permission =
  | 'pages.write'
  | 'projects.write'
  | 'products.write'
  | 'contacts.read'
  | 'visits.read'
  | 'users.manage'
  | 'audit.read';

const ALL_STAFF: StaffRole[] = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'CATALOG_MANAGER'];
const SUPER: StaffRole[] = ['ADMIN', 'SUPER_ADMIN'];
const CONTENT: StaffRole[] = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'];
const CATALOG: StaffRole[] = ['ADMIN', 'SUPER_ADMIN', 'CATALOG_MANAGER'];

/** Role → permissions matrix (server + client must stay aligned). */
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
  ADMIN: 'Super administrateur (legacy)',
  SUPER_ADMIN: 'Super administrateur',
  CONTENT_EDITOR: 'Éditeur contenu',
  CATALOG_MANAGER: 'Gestionnaire catalogue',
};

export const ROLE_JOB_HINTS: Record<Exclude<StaffRole, 'ADMIN'>, string> = {
  SUPER_ADMIN: 'Direction / responsable plateforme',
  CONTENT_EDITOR: 'Marketing / communication — pages & projets',
  CATALOG_MANAGER: 'Commercial / catalogue — produits, contacts, visites',
};

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function isSuperAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function permissionsFor(role: string): Permission[] {
  if (!isStaffRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function rolesForPermission(permission: Permission): StaffRole[] {
  return ALL_STAFF.filter((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export { SUPER, CONTENT, CATALOG, ALL_STAFF };
