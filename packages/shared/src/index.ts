export const SERVICE_PORTS = {
  API_GATEWAY: 3000,
  SERVICE_AUTH: 3001,
  SERVICE_CATALOG: 3002,
  SERVICE_MEDIA: 3003,
  SERVICE_INTERACTION: 3004,
} as const;

export type ServiceName =
  | 'api-gateway'
  | 'service-auth'
  | 'service-catalog'
  | 'service-media'
  | 'service-interaction';

export type { Permission, StaffRole, UserRole } from './permissions';
export {
  ALL_STAFF,
  CATALOG,
  CONTENT,
  ROLE_JOB_HINTS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  SUPER,
  hasPermission,
  isStaffRole,
  isSuperAdminRole,
  permissionsFor,
  rolesForPermission,
} from './permissions';

export interface ApiError {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: ServiceName;
  timestamp: string;
  uptime: number;
}

export function createHealthStatus(service: ServiceName): HealthStatus {
  return {
    status: 'ok',
    service,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

export { setupSwagger } from './swagger';
export type { SwaggerSetupOptions } from './swagger';

export {
  JWT_AUDIENCE,
  JWT_ISSUER,
  assertSecurityConfig,
  corsOrigins,
  getJwtAccessSecret,
  getJwtRefreshSecret,
  isProduction,
  isSwaggerEnabled,
  requireEnv,
  requireSecret,
} from './security';
