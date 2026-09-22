import {
  BadRequestException, Body, CanActivate, ConflictException, Controller, Delete, ExecutionContext,
  ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Injectable, OnModuleDestroy,
  OnModuleInit, Param, Patch, Post, Query, Req, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import bcrypt from 'bcrypt';
import Redis from 'ioredis';
import {
  JWT_AUDIENCE, JWT_ISSUER, getJwtAccessSecret, getJwtRefreshSecret, hasPermission, isProduction,
  isStaffRole, isSuperAdminRole, permissionsFor, type Permission,
} from '@solar/shared';
import { Prisma, PrismaClient, Role, User } from './generated/prisma';

type SafeUser = Omit<User, 'passwordHash'>;
export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  sid?: string;
};
type AuthRequest = {
  user?: JwtPayload;
  headers: { authorization?: string; 'user-agent'?: string };
  ip?: string;
  socket: { remoteAddress?: string };
};

const STAFF_ENUM = [Role.ADMIN, Role.SUPER_ADMIN, Role.CONTENT_EDITOR, Role.CATALOG_MANAGER] as const;

export class RegisterDto {
  @ApiProperty({ example: 'user@solar.local', format: 'email' })
  @IsEmail() email!: string;

  @ApiProperty({ minLength: 8, example: 'User1234!Secure' })
  @IsString() @MinLength(8) password!: string;
}

export class AdminRegisterDto extends RegisterDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional() @IsEnum(Role) role?: Role;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@solar.local' })
  @IsEmail() email!: string;

  @ApiProperty({ example: 'Admin123!Secure' })
  @IsString() password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString() refreshToken!: string;
}

export class CreateStaffDto {
  @ApiProperty({ example: 'editor@solar.local' })
  @IsEmail() email!: string;

  @ApiProperty({ minLength: 12, example: 'Editor123!Secure' })
  @IsString() @MinLength(12) @MaxLength(200) password!: string;

  @ApiProperty({ enum: [Role.SUPER_ADMIN, Role.CONTENT_EDITOR, Role.CATALOG_MANAGER] })
  @IsEnum(Role) role!: Role;

  @ApiPropertyOptional({ example: 'Responsable communication' })
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ enum: [Role.SUPER_ADMIN, Role.CONTENT_EDITOR, Role.CATALOG_MANAGER] })
  @IsOptional() @IsEnum(Role) role?: Role;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean() active?: boolean;

  @ApiPropertyOptional({ minLength: 12 })
  @IsOptional() @IsString() @MinLength(12) @MaxLength(200) password?: string;
}

export class AuditEventDto {
  @ApiProperty({ example: 'product.update' })
  @IsString() @MinLength(2) @MaxLength(120) action!: string;

  @ApiProperty({ example: 'product' })
  @IsString() @MinLength(2) @MaxLength(80) resource!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional() meta?: Record<string, unknown>;
}

class AuthTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}

class SafeUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiPropertyOptional() jobTitle?: string | null;
  @ApiProperty() active!: boolean;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> { await this.$connect(); }
}

@Injectable()
export class AuthRateLimitService {
  private readonly hits = new Map<string, number[]>();
  check(key: string, limit = 10, windowMs = 60_000): void {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true, maxRetriesPerRequest: 1,
  });
  private redisReady = false;

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.redisReady = this.redis.status === 'ready';
    } catch {
      this.redisReady = false;
      if (isProduction()) {
        throw new Error('Redis is required in production for refresh-token revocation');
      }
    }
    await this.maybeSeedAdmin();
  }

  private async maybeSeedAdmin(): Promise<void> {
    if (isProduction() || process.env.ALLOW_DEV_SEED !== 'true') return;
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!email || !password || password.length < 12) {
      throw new Error(
        'ALLOW_DEV_SEED=true requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (>=12 chars)',
      );
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const normalized = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: Role.SUPER_ADMIN,
          active: true,
          jobTitle: existing.jobTitle ?? 'Super administrateur',
        },
      });
      return;
    }
    if ((await this.prisma.user.count()) > 0) return;
    await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        role: Role.SUPER_ADMIN,
        jobTitle: 'Super administrateur',
        active: true,
      },
    });
  }

  async onModuleDestroy(): Promise<void> { this.redis.disconnect(); }

  private safe(user: User): SafeUser & { permissions: Permission[] } {
    const { passwordHash: _passwordHash, ...safe } = user;
    return {
      ...safe,
      permissions: permissionsFor(user.role) as Permission[],
    };
  }

  private assertAssignableRole(role: Role): void {
    if (role === Role.USER || role === Role.ADMIN) {
      throw new BadRequestException('Assign SUPER_ADMIN, CONTENT_EDITOR or CATALOG_MANAGER');
    }
  }

  private clientMeta(req?: AuthRequest) {
    return {
      ip: req?.ip ?? req?.socket?.remoteAddress ?? undefined,
      userAgent: req?.headers?.['user-agent']?.slice(0, 512),
    };
  }

  private async issue(user: User, req?: AuthRequest, existingSessionId?: string) {
    if (!user.active) throw new UnauthorizedException('Account disabled');
    if (!isStaffRole(user.role) && user.role !== Role.USER) {
      throw new UnauthorizedException('Invalid role');
    }

    let sessionId = existingSessionId;
    if (isStaffRole(user.role) && !sessionId) {
      const meta = this.clientMeta(req);
      const session = await this.prisma.adminSession.create({
        data: {
          userId: user.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      sessionId = session.id;
      await this.writeAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.login',
        resource: 'session',
        resourceId: session.id,
        ip: meta.ip,
        meta: { role: user.role },
      });
    } else if (sessionId) {
      await this.prisma.adminSession.update({
        where: { id: sessionId },
        data: { lastSeenAt: new Date() },
      }).catch(() => undefined);
    }

    const base = { sub: user.id, email: user.email, role: user.role, sid: sessionId };
    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access' },
      { secret: getJwtAccessSecret(), expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh' },
      { secret: getJwtRefreshSecret(), expiresIn: '7d', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    return { accessToken, refreshToken, expiresIn: 900, user: this.safe(user) };
  }

  async register(dto: AdminRegisterDto, actor?: JwtPayload) {
    const count = await this.prisma.user.count();
    if (dto.role && dto.role !== Role.USER && !isSuperAdminRole(actor?.role ?? '')) {
      throw new UnauthorizedException('Only a super administrator can create staff accounts');
    }
    if (count === 0 && isProduction()) {
      throw new UnauthorizedException('Bootstrap registration is disabled in production');
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: count === 0 ? Role.SUPER_ADMIN : Role.USER,
          active: true,
        },
      });
      return this.safe(user);
    } catch {
      throw new ConflictException('Email already registered');
    }
  }

  async login(dto: LoginDto, req?: AuthRequest) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.active) throw new UnauthorizedException('Account disabled');
    return this.issue(user, req);
  }

  async refresh(token: string, req?: AuthRequest) {
    if (await this.isBlacklisted(token)) throw new UnauthorizedException('Refresh token revoked');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getJwtRefreshSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) throw new UnauthorizedException();
    return this.issue(user, req, payload.sid);
  }

  async logout(token: string, actor?: JwtPayload): Promise<{ success: true }> {
    if (actor?.sid) {
      await this.prisma.adminSession.updateMany({
        where: { id: actor.sid, logoutAt: null },
        data: { logoutAt: new Date(), lastSeenAt: new Date() },
      });
      await this.writeAudit({
        actorId: actor.sub,
        actorEmail: actor.email,
        action: 'auth.logout',
        resource: 'session',
        resourceId: actor.sid,
      });
    }
    if (!this.redisReady) {
      if (isProduction()) throw new HttpException('Logout unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      return { success: true };
    }
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    const ttl = Math.max(1, (decoded?.exp ?? Math.floor(Date.now() / 1000) + 604800) - Math.floor(Date.now() / 1000));
    await this.redis.set(`refresh:blacklist:${token}`, '1', 'EX', ttl);
    return { success: true };
  }

  private async isBlacklisted(token: string): Promise<boolean> {
    if (!this.redisReady) {
      if (isProduction()) throw new HttpException('Token revocation store unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      return false;
    }
    return (await this.redis.exists(`refresh:blacklist:${token}`)) === 1;
  }

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.safe(user);
  }

  async writeAudit(input: {
    actorId?: string;
    actorEmail: string;
    action: string;
    resource: string;
    resourceId?: string;
    ip?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail.slice(0, 200),
        action: input.action.slice(0, 120),
        resource: input.resource.slice(0, 80),
        resourceId: input.resourceId?.slice(0, 80),
        ip: input.ip?.slice(0, 80),
        meta: input.meta ? (input.meta as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  listStaff() {
    return this.prisma.user.findMany({
      where: { role: { in: [...STAFF_ENUM] } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: {
        id: true, email: true, role: true, jobTitle: true, active: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async createStaff(dto: CreateStaffDto, actor: JwtPayload, ip?: string) {
    this.assertAssignableRole(dto.role);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: dto.role,
          jobTitle: dto.jobTitle?.trim() || null,
          active: true,
        },
      });
      await this.writeAudit({
        actorId: actor.sub,
        actorEmail: actor.email,
        action: 'user.create',
        resource: 'user',
        resourceId: user.id,
        ip,
        meta: { role: user.role, email: user.email },
      });
      return this.safe(user);
    } catch {
      throw new ConflictException('Email already registered');
    }
  }

  async updateStaff(id: string, dto: UpdateStaffDto, actor: JwtPayload, ip?: string) {
    if (dto.role) this.assertAssignableRole(dto.role);
    if (id === actor.sub && dto.active === false) {
      throw new BadRequestException('You cannot disable your own account');
    }
    if (id === actor.sub && dto.role && !isSuperAdminRole(dto.role)) {
      throw new BadRequestException('You cannot remove your own super-admin role');
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.role) data.role = dto.role;
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle.trim() || null;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.update({ where: { id }, data });
    if (!isStaffRole(user.role) && user.role !== Role.USER) {
      throw new BadRequestException('Invalid resulting role');
    }
    await this.writeAudit({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'user.update',
      resource: 'user',
      resourceId: user.id,
      ip,
      meta: { role: user.role, active: user.active },
    });
    return this.safe(user);
  }

  async disableStaff(id: string, actor: JwtPayload, ip?: string) {
    if (id === actor.sub) throw new BadRequestException('You cannot delete your own account');
    const user = await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
    await this.writeAudit({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'user.disable',
      resource: 'user',
      resourceId: user.id,
      ip,
    });
    return this.safe(user);
  }

  async listAudit(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async listSessions(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminSession.findMany({
        orderBy: { loginAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          user: { select: { id: true, email: true, role: true, jobTitle: true } },
        },
      }),
      this.prisma.adminSession.count(),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }
}

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const Permissions = (...permissions: Permission[]) => SetMetadata('permissions', permissions);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getJwtAccessSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (payload.type !== 'access') throw new Error('Wrong token type');
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const needed = this.reflector.getAllAndOverride<Permission[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!needed?.length) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || !needed.every((p) => hasPermission(req.user!.role, p))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || !isSuperAdminRole(req.user.role)) {
      throw new ForbiddenException('Super administrator required');
    }
    return true;
  }
}

@ApiTags('auth')
@Controller(['', 'auth'])
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly rate: AuthRateLimitService,
  ) {}

  private clientKey(context: AuthRequest): string {
    return context.ip ?? context.socket?.remoteAddress ?? 'unknown';
  }

  private optionalUser(authorization?: string): JwtPayload | undefined {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return undefined;
    try {
      return this.jwt.verify<JwtPayload>(token, {
        secret: getJwtAccessSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      return undefined;
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a user' })
  register(@Body() dto: AdminRegisterDto, @Req() context: AuthRequest) {
    this.rate.check(`register:${this.clientKey(context)}`, 5);
    return this.auth.register(dto, this.optionalUser(context.headers?.authorization));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  login(@Body() dto: LoginDto, @Req() context: AuthRequest) {
    this.rate.check(`login:${this.clientKey(context)}:${dto.email.toLowerCase()}`, 10);
    return this.auth.login(dto, context);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() context: AuthRequest) {
    this.rate.check(`refresh:${this.clientKey(context)}`, 20);
    return this.auth.refresh(dto.refreshToken, context);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto, @Req() context: AuthRequest) {
    const actor = this.optionalUser(context.headers?.authorization);
    return this.auth.logout(dto.refreshToken, actor);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: SafeUserDto })
  me(@Req() context: AuthRequest) {
    return this.auth.me(context.user!.sub);
  }

  @Get('admin/users')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List staff users (SUPER_ADMIN)' })
  listUsers() {
    return this.auth.listStaff();
  }

  @Post('admin/users')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Create staff user (SUPER_ADMIN)' })
  createUser(@Body() dto: CreateStaffDto, @Req() context: AuthRequest) {
    this.rate.check(`staff-create:${this.clientKey(context)}`, 10);
    return this.auth.createStaff(dto, context.user!, this.clientKey(context));
  }

  @Patch('admin/users/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  updateUser(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() context: AuthRequest) {
    if (!id || id.length < 10) throw new BadRequestException('Invalid id');
    return this.auth.updateStaff(id, dto, context.user!, this.clientKey(context));
  }

  @Delete('admin/users/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  disableUser(@Param('id') id: string, @Req() context: AuthRequest) {
    return this.auth.disableStaff(id, context.user!, this.clientKey(context));
  }

  @Get('admin/audit')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Audit trail (SUPER_ADMIN)' })
  listAudit(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auth.listAudit(Number(page) || 1, Number(limit) || 50);
  }

  @Get('admin/sessions')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Admin connection sessions (SUPER_ADMIN)' })
  listSessions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auth.listSessions(Number(page) || 1, Number(limit) || 50);
  }

  @Post('admin/audit/events')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Record audit event (staff JWT — actor taken from token)' })
  async recordAudit(@Body() dto: AuditEventDto, @Req() context: AuthRequest) {
    if (!isStaffRole(context.user!.role)) throw new ForbiddenException();
    // Prevent privilege escalation via forged actor fields — always use JWT identity
    return this.auth.writeAudit({
      actorId: context.user!.sub,
      actorEmail: context.user!.email,
      action: dto.action,
      resource: dto.resource,
      resourceId: dto.resourceId,
      ip: this.clientKey(context),
      meta: dto.meta,
    });
  }
}
