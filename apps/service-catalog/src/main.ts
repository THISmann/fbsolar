import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SERVICE_PORTS, assertSecurityConfig, corsOrigins, setupSwagger } from '@solar/shared';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap(): Promise<void> {
  assertSecurityConfig();
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Page renders arrive from the web container's nginx on behalf of every visitor.
    skip: (req) => req.path.startsWith('/seo/') && !req.headers['x-forwarded-prefix'],
  }));
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  setupSwagger(app, {
    title: 'Solar Catalog API',
    description: `
Products, categories and blog articles.

- **Public GET** returns only \`published=true\` resources
- **POST/PATCH/DELETE** require ADMIN JWT (\`Authorize\` in Swagger UI)
- Unique slug conflicts return **409**
`.trim(),
    serverUrl: 'http://localhost/api/catalog',
    extraServers: [{ url: 'http://localhost:3002', description: 'Direct (dev overlay)' }],
  });
  const port = Number(process.env.PORT) || SERVICE_PORTS.SERVICE_CATALOG;
  await app.listen(port);
  Logger.log(`Catalog Service listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost/api/catalog/docs`, 'Bootstrap');
}

void bootstrap();
