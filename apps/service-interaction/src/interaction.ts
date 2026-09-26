import {
  BadRequestException, Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpException, HttpStatus,
  Injectable, Logger, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import amqp, { Channel, ChannelModel } from 'amqplib';
import {
  JWT_AUDIENCE, JWT_ISSUER, corsOrigins, getJwtAccessSecret, hasPermission, isProduction, isStaffRole,
} from '@solar/shared';
import { PrismaClient } from './generated/prisma';

type JwtPayload = { sub: string; email: string; role: string; type: string };
type HttpRequest = {
  ip?: string;
  socket: { remoteAddress?: string };
  headers?: { authorization?: string; referer?: string };
  user?: JwtPayload;
};
type ChatInput = { visitorId: string; message: string; sender?: string };

export type ContentChangedEvent = {
  resource: 'product' | 'project' | 'page' | 'category' | 'article' | 'contact' | 'media';
  action: 'created' | 'updated' | 'deleted';
  id?: string;
  slug?: string;
  key?: string;
  kind?: 'PRODUCT' | 'PROJECT';
  at: string;
};

function normalizeContentEvent(routingKey: string, raw: Record<string, unknown>): ContentChangedEvent | null {
  if (routingKey === 'contact.created') {
    return {
      resource: 'contact',
      action: 'created',
      id: typeof raw.id === 'string' ? raw.id : undefined,
      at: new Date().toISOString(),
    };
  }
  if (routingKey === 'content.changed' || raw.resource) {
    const resource = raw.resource as ContentChangedEvent['resource'] | undefined;
    const action = raw.action as ContentChangedEvent['action'] | undefined;
    if (!resource || !action) return null;
    return {
      resource,
      action,
      id: typeof raw.id === 'string' ? raw.id : undefined,
      slug: typeof raw.slug === 'string' ? raw.slug : undefined,
      key: typeof raw.key === 'string' ? raw.key : undefined,
      kind: raw.kind === 'PRODUCT' || raw.kind === 'PROJECT' ? raw.kind : undefined,
      at: typeof raw.at === 'string' ? raw.at : new Date().toISOString(),
    };
  }
  return null;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

export class ContactDto {
  @ApiProperty({ example: 'Jean Dupont', minLength: 2, maxLength: 100 })
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty({ example: 'jean@example.com', format: 'email' })
  @IsEmail() email!: string;
  @ApiPropertyOptional({ example: '+33600000000', maxLength: 30 })
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiProperty({
    example: 'Bonjour, je souhaite un devis pour des panneaux solaires.',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString() @MinLength(10) @MaxLength(5000) message!: string;
  @ApiPropertyOptional({
    description: 'Turnstile/hCaptcha token — required when TURNSTILE_SECRET_KEY is set (mandatory in production)',
  })
  @IsOptional() @IsString() captchaToken?: string;
}

export class VisitDto {
  @ApiProperty({ example: '/produits', maxLength: 500 })
  @IsString() @MinLength(1) @MaxLength(500) path!: string;
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional() @IsString() @MaxLength(1000) referrer?: string;
  @ApiPropertyOptional({ description: 'Anonymous visitor id (UUID preferred)', maxLength: 64 })
  @IsOptional() @IsString() @MaxLength(64) visitorId?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> { await this.$connect(); }
}

@Injectable()
export class InteractionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InteractionService.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private contentBroadcast?: (event: ContentChangedEvent) => void;

  constructor(private readonly db: PrismaService) {}

  /** Wired by ChatGateway once Socket.IO server is ready. */
  setContentBroadcaster(fn: (event: ContentChangedEvent) => void): void {
    this.contentBroadcast = fn;
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.RABBITMQ_URL) return;
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange('solar.events', 'topic', { durable: true });
      const q = await this.channel.assertQueue('solar.content.realtime', { durable: true });
      await this.channel.bindQueue(q.queue, 'solar.events', 'content.changed');
      await this.channel.consume(q.queue, (msg) => {
        if (!msg) return;
        try {
          const raw = JSON.parse(msg.content.toString()) as Record<string, unknown>;
          const event = normalizeContentEvent(msg.fields.routingKey, raw);
          if (event) this.contentBroadcast?.(event);
        } catch (error) {
          this.logger.warn(`Bad content event payload: ${error instanceof Error ? error.message : 'unknown'}`);
        } finally {
          this.channel?.ack(msg);
        }
      });
    } catch (error) {
      this.logger.warn(`RabbitMQ unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
  async contact(dto: ContactDto) {
    const { captchaToken: _captchaToken, ...data } = dto;
    const created = await this.db.contactMessage.create({ data });
    try {
      this.channel?.publish('solar.events', 'contact.created', Buffer.from(JSON.stringify(created)), { persistent: true });
    } catch (error) {
      this.logger.warn(`Could not publish contact.created: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    this.contentBroadcast?.({
      resource: 'contact',
      action: 'created',
      id: created.id,
      at: new Date().toISOString(),
    });
    return created;
  }
  async listContacts(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [items, total, unread] = await this.db.$transaction([
      this.db.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.db.contactMessage.count(),
      this.db.contactMessage.count({ where: { readAt: null } }),
    ]);
    return { items, total, unread, page: safePage, limit: safeLimit };
  }
  contactOne(id: string) {
    return this.db.contactMessage.findUniqueOrThrow({ where: { id } });
  }
  async markContactRead(id: string) {
    const updated = await this.db.contactMessage.update({ where: { id }, data: { readAt: new Date() } });
    this.contentBroadcast?.({
      resource: 'contact',
      action: 'updated',
      id: updated.id,
      at: new Date().toISOString(),
    });
    return updated;
  }
  async deleteContact(id: string) {
    await this.db.contactMessage.delete({ where: { id } });
    this.contentBroadcast?.({
      resource: 'contact',
      action: 'deleted',
      id,
      at: new Date().toISOString(),
    });
    return { success: true };
  }
  trackVisit(dto: VisitDto) {
    const path = dto.path.startsWith('/') ? dto.path.slice(0, 500) : `/${dto.path.slice(0, 499)}`;
    return this.db.pageView.create({
      data: {
        path,
        referrer: dto.referrer?.slice(0, 1000),
        visitorId: dto.visitorId?.slice(0, 64),
      },
    });
  }
  async visitStats(days = 30) {
    const safeDays = Math.min(90, Math.max(1, days));
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const views = await this.db.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { path: true, visitorId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byPath = new Map<string, number>();
    const byDay = new Map<string, number>();
    const visitors = new Set<string>();
    for (const view of views) {
      byPath.set(view.path, (byPath.get(view.path) ?? 0) + 1);
      const day = view.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (view.visitorId) visitors.add(view.visitorId);
    }
    return {
      days: safeDays,
      totalViews: views.length,
      uniqueVisitors: visitors.size,
      byPath: [...byPath.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count),
      byDay: [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
  history(visitorId: string, limit: number) {
    return this.db.chatMessage.findMany({
      where: { visitorId }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)),
    });
  }
  saveChat(input: ChatInput) {
    return this.db.chatMessage.create({ data: {
      visitorId: input.visitorId, sender: input.sender ?? 'visitor', message: escapeHtml(input.message),
    } });
  }
  markRead(visitorId: string) {
    return this.db.chatMessage.updateMany({ where: { visitorId, readAt: null }, data: { readAt: new Date() } });
  }
}

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, number[]>();
  check(ip: string, limit = 5, windowMs = 60_000, label = 'contact'): void {
    const key = `${label}:${ip}`;
    const now = Date.now();
    const recent = (this.entries.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) throw new HttpException(`Maximum ${limit} ${label} requests per minute`, HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.entries.set(key, recent);
  }
}

@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const token = request.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Staff access required');
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getJwtAccessSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (payload.type !== 'access' || !isStaffRole(payload.role)) {
        throw new Error('Staff access required');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Staff access required');
    }
  }
}

function assertPermission(role: string, permission: 'contacts.read' | 'visits.read') {
  if (!hasPermission(role, permission)) {
    throw new UnauthorizedException(`Missing permission ${permission}`);
  }
}

async function recordAudit(
  authorization: string | undefined,
  action: string,
  resource: string,
  resourceId?: string,
): Promise<void> {
  if (!authorization) return;
  const base = process.env.AUTH_INTERNAL_URL?.replace(/\/$/, '') || 'http://service-auth:3001';
  try {
    await fetch(`${base}/admin/audit/events`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ action, resource, resourceId }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* ignore */
  }
}

@ApiTags('interaction')
@Controller()
export class InteractionController {
  constructor(private readonly service: InteractionService, private readonly rate: RateLimitService) {}
  @Post('contact')
  @ApiOperation({
    summary: 'Submit contact form',
    description: 'Public. Rate-limited to 5 requests/min/IP. Captcha required when TURNSTILE_SECRET_KEY is configured (always in production).',
  })
  @ApiResponse({ status: 201, description: 'Contact message stored' })
  @ApiResponse({ status: 400, description: 'Validation or captcha failure' })
  @ApiResponse({ status: 429, description: 'Too many contact requests' })
  async contact(@Body() dto: ContactDto, @Req() request: HttpRequest) {
    this.rate.check(request.ip ?? request.socket.remoteAddress ?? 'unknown', 5, 60_000, 'contact');
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (isProduction() && !turnstileSecret) {
      throw new Error('TURNSTILE_SECRET_KEY is required in production');
    }
    if (turnstileSecret) {
      if (!dto.captchaToken) throw new BadRequestException('captchaToken is required');
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: dto.captchaToken }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new BadRequestException('Captcha verification unavailable');
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' || result === null ||
        !('success' in result) || typeof result.success !== 'boolean' || !result.success
      ) throw new BadRequestException('Captcha verification failed');
    }
    return this.service.contact(dto);
  }

  @Get('contact')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List contact messages (catalog staff)' })
  @UseGuards(JwtAdminGuard)
  listContacts(@Query('page') page?: string, @Query('limit') limit?: string, @Req() request?: HttpRequest) {
    assertPermission(request!.user!.role, 'contacts.read');
    return this.service.listContacts(Number(page) || 1, Number(limit) || 20);
  }

  @Get('contact/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get contact message (catalog staff)' })
  @UseGuards(JwtAdminGuard)
  contactOne(@Param('id') id: string, @Req() request: HttpRequest) {
    assertPermission(request.user!.role, 'contacts.read');
    if (!isUUID(id)) throw new BadRequestException('Invalid id');
    return this.service.contactOne(id);
  }

  @Patch('contact/:id/read')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark contact message as read (catalog staff)' })
  @UseGuards(JwtAdminGuard)
  async markRead(@Param('id') id: string, @Req() request: HttpRequest) {
    assertPermission(request.user!.role, 'contacts.read');
    if (!isUUID(id)) throw new BadRequestException('Invalid id');
    const updated = await this.service.markContactRead(id);
    void recordAudit(request.headers?.authorization, 'contact.read', 'contact', id);
    return updated;
  }

  @Delete('contact/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete contact message (catalog staff)' })
  @UseGuards(JwtAdminGuard)
  async deleteContact(@Param('id') id: string, @Req() request: HttpRequest) {
    assertPermission(request.user!.role, 'contacts.read');
    if (!isUUID(id)) throw new BadRequestException('Invalid id');
    const result = await this.service.deleteContact(id);
    void recordAudit(request.headers?.authorization, 'contact.delete', 'contact', id);
    return result;
  }

  @Post('visits')
  @ApiOperation({ summary: 'Track a page view (public, rate-limited)' })
  trackVisit(@Body() dto: VisitDto, @Req() request: HttpRequest) {
    this.rate.check(request.ip ?? request.socket.remoteAddress ?? 'unknown', 60, 60_000, 'visits');
    return this.service.trackVisit({
      ...dto,
      referrer: dto.referrer ?? request.headers?.referer,
    });
  }

  @Get('visits/stats')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Visit analytics (catalog staff)' })
  @UseGuards(JwtAdminGuard)
  visitStats(@Query('days') days?: string, @Req() request?: HttpRequest) {
    assertPermission(request!.user!.role, 'visits.read');
    return this.service.visitStats(Number(days) || 30);
  }

  @Get('chat/messages')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Chat history (ADMIN)',
    description: 'Requires ADMIN access JWT. Returns messages for a visitor UUID (max 100).',
  })
  @ApiQuery({ name: 'visitorId', required: true, example: '11111111-1111-4111-8111-111111111111', description: 'Visitor UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Array of chat messages' })
  @ApiResponse({ status: 401, description: 'Administrator access required' })
  @UseGuards(JwtAdminGuard)
  history(@Query('visitorId') visitorId: string, @Query('limit') limit?: string) {
    if (!visitorId) throw new BadRequestException('visitorId is required');
    return this.service.history(visitorId, Number(limit) || 50);
  }
}

@WebSocketGateway({ cors: { origin: corsOrigins(), credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer() server!: Server;
  constructor(private readonly service: InteractionService, private readonly jwt: JwtService) {}

  onModuleInit(): void {
    this.service.setContentBroadcaster((event) => {
      this.server.to('content:public').emit('content:changed', event);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = typeof client.handshake.auth.token === 'string' ? client.handshake.auth.token : undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          secret: getJwtAccessSecret(),
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });
        if (payload.type !== 'access' || !isStaffRole(payload.role)) throw new Error('Invalid admin token');
        client.data.role = payload.role;
        await client.join('admin:global');
        await client.join('content:public');
        return;
      } catch {
        client.disconnect(true);
        return;
      }
    }
    const visitorId = typeof client.handshake.auth.visitorId === 'string'
      ? client.handshake.auth.visitorId
      : undefined;
    if (!visitorId || !isUUID(visitorId)) {
      client.disconnect(true);
      return;
    }
    client.data.visitorId = visitorId;
    await client.join(`visitor:${visitorId}`);
    await client.join('content:public');
  }
  private authorizeVisitor(client: Socket, visitorId: string): void {
    if (!isUUID(visitorId)) throw new BadRequestException('Valid visitorId is required');
    if (!isStaffRole(String(client.data.role ?? '')) && client.data.visitorId !== visitorId) {
      throw new UnauthorizedException('Visitor access denied');
    }
  }
  @SubscribeMessage('chat:message')
  async message(@MessageBody() input: ChatInput, @ConnectedSocket() client: Socket) {
    if (!input.visitorId || !input.message?.trim()) throw new BadRequestException('visitorId and message are required');
    this.authorizeVisitor(client, input.visitorId);
    const sender = client.data.role === 'ADMIN' ? 'admin' : 'visitor';
    const created = await this.service.saveChat({ ...input, sender });
    this.server.to(`visitor:${input.visitorId}`).to('admin:global').emit('chat:message', created);
    return created;
  }
  @SubscribeMessage('chat:typing')
  typing(@MessageBody() input: { visitorId: string; typing: boolean }, @ConnectedSocket() client: Socket): void {
    this.authorizeVisitor(client, input.visitorId);
    client.to(`visitor:${input.visitorId}`).to('admin:global').emit('chat:typing', input);
  }
  @SubscribeMessage('chat:read')
  async read(@MessageBody() input: { visitorId: string }, @ConnectedSocket() client: Socket) {
    this.authorizeVisitor(client, input.visitorId);
    await this.service.markRead(input.visitorId);
    this.server.to(`visitor:${input.visitorId}`).to('admin:global').emit('chat:read', input);
    return { success: true };
  }
}
