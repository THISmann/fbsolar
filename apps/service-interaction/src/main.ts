import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { SERVICE_PORTS, assertSecurityConfig, corsOrigins, setupSwagger } from '@solar/shared';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  async connect(): Promise<void> {
    if (!process.env.REDIS_URL) return;
    const publisher = new Redis(process.env.REDIS_URL);
    const subscriber = publisher.duplicate();
    await Promise.all([publisher.ping(), subscriber.ping()]);
    this.adapterConstructor = createAdapter(publisher, subscriber);
  }
  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap(): Promise<void> {
  assertSecurityConfig();
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  setupSwagger(app, {
    title: 'Solar Interaction API',
    description: `
Contact forms and live chat.

**REST**
- \`POST /contact\` — public, rate-limited, optional/required captcha
- \`GET /chat/messages\` — ADMIN JWT only

**WebSocket** (Socket.IO, not executable in Swagger UI) — connect via \`ws://localhost/ws\`
- Visitor: \`auth: { visitorId: <uuid> }\`
- Admin: \`auth: { token: <accessJWT> }\` (role from JWT only)
- Events: \`chat:message\`, \`chat:typing\`, \`chat:read\` — sender is derived server-side
`.trim(),
    serverUrl: 'http://localhost/api/interaction',
    extraServers: [{ url: 'http://localhost:3004', description: 'Direct (dev overlay)' }],
  });
  const adapter = new RedisIoAdapter(app);
  await adapter
    .connect()
    .catch((error: unknown) => Logger.warn(`Socket Redis adapter disabled: ${String(error)}`));
  app.useWebSocketAdapter(adapter);
  const port = Number(process.env.PORT) || SERVICE_PORTS.SERVICE_INTERACTION;
  await app.listen(port);
  Logger.log(`Interaction Service listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost/api/interaction/docs`, 'Bootstrap');
}

void bootstrap();
