import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { isSwaggerEnabled } from './security';

export interface SwaggerSetupOptions {
  title: string;
  description: string;
  version?: string;
  path?: string;
  /** Enable JWT bearer auth button in Swagger UI (default: true) */
  bearerAuth?: boolean;
  /** Primary Try-it-out base URL (Traefik path preferred) */
  serverUrl?: string;
  /** Extra servers shown in the UI dropdown */
  extraServers?: Array<{ url: string; description?: string }>;
}

const SECURITY_FOOTER = `
### Security (OWASP API Top 10)
- JWT access tokens: **15m**, refresh: **7d**, claims \`iss\`/\`aud\`/\`type\` validated
- Write / privileged routes require **Bearer JWT** (ADMIN where noted)
- Rate limits and Helmet applied at service level
- Swagger is **disabled in production** unless \`SWAGGER_ENABLED=true\`
`.trim();

/**
 * Mount Swagger UI at `/docs` when enabled (disabled in production by default).
 * Via Traefik: `http://localhost/api/<service>/docs`
 */
export function setupSwagger(app: INestApplication, options: SwaggerSetupOptions): void {
  if (!isSwaggerEnabled()) {
    return;
  }

  const builder = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(`${options.description.trim()}\n\n${SECURITY_FOOTER}`)
    .setVersion(options.version ?? '1.0.0')
    .setContact('Solar Platform', 'http://localhost', 'admin@solar.local');

  if (options.serverUrl) {
    builder.addServer(options.serverUrl, 'Traefik (recommended)');
  }
  for (const server of options.extraServers ?? []) {
    builder.addServer(server.url, server.description);
  }

  if (options.bearerAuth !== false) {
    builder.addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token from POST /login (Authorization: Bearer <accessToken>). Use Authorize in Swagger UI.',
      },
      'JWT',
    );
  }

  const document = SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup(options.path ?? 'docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: `${options.title} · Docs`,
    customCss: '.swagger-ui .topbar { display: none }',
  });
}
