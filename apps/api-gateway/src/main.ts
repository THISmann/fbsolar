import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SERVICE_PORTS, corsOrigins, setupSwagger } from '@solar/shared';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { correlationMiddleware, GlobalExceptionFilter } from './http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // CSP disabled so Swagger UI assets load correctly
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(correlationMiddleware);
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  setupSwagger(app, {
    title: 'Solar API Gateway',
    description: `
Gateway entrypoint (health + security middleware). Business APIs are documented per service:

| Service | Swagger UI |
|---------|------------|
| Auth | [http://localhost/api/auth/docs](http://localhost/api/auth/docs) |
| Catalog | [http://localhost/api/catalog/docs](http://localhost/api/catalog/docs) |
| Media | [http://localhost/api/media/docs](http://localhost/api/media/docs) |
| Interaction | [http://localhost/api/interaction/docs](http://localhost/api/interaction/docs) |

OpenAPI JSON: append \`-json\` (e.g. \`/api/auth/docs-json\`).
`.trim(),
    serverUrl: 'http://localhost',
    bearerAuth: false,
  });
  const port = Number(process.env.PORT) || SERVICE_PORTS.API_GATEWAY;
  await app.listen(port);
  Logger.log(`API Gateway listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost/docs (gateway) · http://localhost/api/*/docs`, 'Bootstrap');
}

void bootstrap();
