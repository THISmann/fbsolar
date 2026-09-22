import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SERVICE_PORTS, assertSecurityConfig, corsOrigins, setupSwagger } from '@solar/shared';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap(): Promise<void> {
  assertSecurityConfig();
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // Admin UI runs on :5173 while media is on :80 — must allow cross-origin <img>.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  setupSwagger(app, {
    title: 'Solar Media API',
    description: [
      'File upload to MinIO with ownership controls.',
      '',
      '- Upload requires JWT and returns a stable public url',
      '- GET /file/:id public stream for CMS images',
      '- GET /:id owner/staff — presigned URL (1h) + publicUrl',
      '- DELETE requires staff',
      '- Magic-bytes validation · max 10MB · memory upload to MinIO',
    ].join('\n'),
    serverUrl: 'http://localhost/api/media',
    extraServers: [{ url: 'http://localhost:3003', description: 'Direct (dev overlay)' }],
  });
  const port = Number(process.env.PORT) || SERVICE_PORTS.SERVICE_MEDIA;
  await app.listen(port);
  Logger.log(`Media Service listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost/api/media/docs`, 'Bootstrap');
}

void bootstrap();
