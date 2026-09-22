import { Logger } from '@nestjs/common';

const WEAK_SECRETS = new Set([
  'dev_access_secret',
  'dev_refresh_secret',
  'dev_access_secret_change_me_32chars',
  'dev_access_secret_change_me_32chars!!',
  'dev_refresh_secret_change_me_32chars',
  'dev_refresh_secret_change_me_32chars!',
  'change_me',
  'secret',
  'password',
]);

export const JWT_ISSUER = 'solar-platform';
export const JWT_AUDIENCE = 'solar-api';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Swagger only outside production, unless SWAGGER_ENABLED=true */
export function isSwaggerEnabled(): boolean {
  if (process.env.SWAGGER_ENABLED === 'true') return true;
  if (process.env.SWAGGER_ENABLED === 'false') return false;
  return !isProduction();
}

export function requireEnv(name: string, minLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new Error(`Missing or too short required environment variable: ${name} (min ${minLength} chars)`);
  }
  return value;
}

export function requireSecret(name: string, minLength = 32): string {
  const value = requireEnv(name, minLength);
  if (WEAK_SECRETS.has(value) || value.toLowerCase().includes('change_me')) {
    throw new Error(`Refusing weak/default secret for ${name}. Set a strong unique value (>= ${minLength} chars).`);
  }
  return value;
}

export function getJwtAccessSecret(): string {
  return requireSecret('JWT_ACCESS_SECRET', 32);
}

export function getJwtRefreshSecret(): string {
  return requireSecret('JWT_REFRESH_SECRET', 32);
}

/** Call once at bootstrap — fail fast before listening */
export function assertSecurityConfig(options?: { requireRedis?: boolean }): void {
  const logger = new Logger('SecurityConfig');
  getJwtAccessSecret();
  getJwtRefreshSecret();
  if (options?.requireRedis) {
    requireEnv('REDIS_URL', 8);
  }
  if (isProduction()) {
    if (process.env.ALLOW_DEV_SEED === 'true') {
      throw new Error('ALLOW_DEV_SEED must not be true in production');
    }
    if (!process.env.CORS_ORIGINS?.trim()) {
      logger.warn('CORS_ORIGINS is empty in production — CORS will deny all browser origins');
    }
  }
  logger.log('Security configuration validated');
}

export function corsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return isProduction() ? false : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}
