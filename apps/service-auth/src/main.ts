import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import {
  SERVICE_PORTS, assertSecurityConfig, corsOrigins, setupSwagger,
} from '@solar/shared';

async function bootstrap(): Promise<void> {
  assertSecurityConfig({ requireRedis: process.env.NODE_ENV === 'production' });
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  setupSwagger(app, {
    title: 'Solar Auth API',
    description: `
Authentication microservice for Solar Platform.

**Flows**
1. \`POST /login\` → copy \`accessToken\` → Authorize (Bearer)
2. \`POST /refresh\` / \`POST /logout\` with refresh token
3. \`GET /me\` for the current user profile

**Seed (dev only)** — \`ALLOW_DEV_SEED=true\` + \`BOOTSTRAP_ADMIN_*\`
`.trim(),
    serverUrl: 'http://localhost/api/auth',
    extraServers: [{ url: 'http://localhost:3001', description: 'Direct (dev overlay)' }],
  });
  const port = Number(process.env.PORT) || SERVICE_PORTS.SERVICE_AUTH;
  await app.listen(port);
  Logger.log(`Auth Service listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost/api/auth/docs`, 'Bootstrap');
}

void bootstrap();
