import {
  BadRequestException, Body, CanActivate, ConflictException, Controller, DefaultValuePipe, Delete, ExecutionContext, ForbiddenException, Get,
  HttpCode, HttpStatus, Injectable, OnModuleDestroy, OnModuleInit, Param, ParseIntPipe, Patch, Post, Put, Query, Req,
  SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import Redis from 'ioredis';
import { JWT_AUDIENCE, JWT_ISSUER, getJwtAccessSecret, hasPermission, isStaffRole, type Permission } from '@solar/shared';
import { Prisma, PrismaClient } from './generated/prisma';
import { SocialPublishService, type SocialNetworkCode } from './social';
import { ContentEventsService } from './content-events';

type AuthRequest = {
  headers: { authorization?: string };
  user?: { sub: string; email: string; role: string; type: string };
  ip?: string;
  socket?: { remoteAddress?: string };
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.ensureCatalogSeed();
  }

  /** Idempotent seed: equipment categories + showcase products for the vitrine. */
  private async ensureCatalogSeed(): Promise<void> {
    const categories = [
      { name: 'Panneaux solaires', slug: 'panneaux-solaires' },
      { name: 'Batteries', slug: 'batteries' },
      { name: 'Onduleurs', slug: 'onduleurs' },
      { name: 'Accessoires & outils', slug: 'accessoires-outils' },
      { name: 'Kits solaires', slug: 'solar-kits' },
      { name: 'Réalisations', slug: 'realisations' },
    ] as const;

    const categoryIds = new Map<string, string>();
    for (const cat of categories) {
      const row = await this.category.upsert({
        where: { slug: cat.slug },
        create: { name: cat.name, slug: cat.slug },
        update: { name: cat.name },
      });
      categoryIds.set(cat.slug, row.id);
    }

    const products: Array<{
      slug: string;
      name: string;
      description: string;
      price: number;
      category: string;
      images: string[];
      kind?: 'PRODUCT' | 'PROJECT';
    }> = [
      {
        slug: 'panneau-mono-430w',
        name: 'Panneau monocristallin 430 W',
        description: 'Module haute efficacité pour toitures résidentielles. Cadre aluminium, verre trempé, garantie performance 25 ans.',
        price: 125000,
        category: 'panneaux-solaires',
        images: ['https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'panneau-bi-facial-500w',
        name: 'Panneau bi-facial 500 W',
        description: 'Double face pour maximiser le rendement sur carports et ombrières. Idéal projets tertiaires.',
        price: 170000,
        category: 'panneaux-solaires',
        images: ['https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'batterie-lithium-5kwh',
        name: 'Batterie lithium 5 kWh',
        description: 'Stockage résidentiel compact pour l’autoconsommation du soir. Monitoring intégré, cycle de vie élevé.',
        price: 2150000,
        category: 'batteries',
        images: ['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'batterie-lithium-10kwh',
        name: 'Batterie lithium 10 kWh',
        description: 'Capacité familiale / petite entreprise. Modularité possible, compatible onduleurs hybrides courants.',
        price: 3850000,
        category: 'batteries',
        images: ['https://images.unsplash.com/photo-1593941707881-a5b1ffdf6b6d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'onduleur-string-6kw',
        name: 'Onduleur string 6 kW',
        description: 'Conversion DC/AC fiable pour installations mono-phase. Wifi, suivi de production en temps réel.',
        price: 640000,
        category: 'onduleurs',
        images: ['https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'onduleur-hybride-8kw',
        name: 'Onduleur hybride 8 kW',
        description: 'Gestion panneaux + batterie + réseau. Mode secours, idéal autoconsommation avancée.',
        price: 1400000,
        category: 'onduleurs',
        images: ['https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'structure-toit-tuile',
        name: 'Kit structure toiture tuile',
        description: 'Rails, crochets et fixations pour tuiles mécaniques. Acier inox / aluminium, pose soignée.',
        price: 210000,
        category: 'accessoires-outils',
        images: ['https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'coffret-dc-ac-protection',
        name: 'Coffret de protection DC/AC',
        description: 'Paraoudres, sectionneurs et disjoncteurs pré-câblés pour une mise en conformité simplifiée.',
        price: 180000,
        category: 'accessoires-outils',
        images: ['https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'home-solar-kit',
        name: 'Kit solaire maison 3 kWc',
        description: 'Pack résidentiel prêt à poser : panneaux, onduleur string, structure et coffrets. Étude sur mesure possible.',
        price: 3275000,
        category: 'solar-kits',
        images: ['https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'pro-solar-kit',
        name: 'Kit solaire pro 9 kWc',
        description: 'Solution tertiaire / grande toiture : modules haute puissance, onduleur adapté et monitoring.',
        price: 5900000,
        category: 'solar-kits',
        images: ['https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'villa-lyon-6kwc',
        name: 'Villa Lyon — 6 kWc',
        description: 'Installation résidentielle intégrée tuiles, autoconsommation et monitoring.',
        price: 0,
        category: 'realisations',
        kind: 'PROJECT',
        images: ['https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'entrepot-saint-etienne',
        name: 'Entrepôt Saint-Étienne — 120 kWc',
        description: 'Ombrière et toiture industrielle, raccordement HTA et suivi de performance.',
        price: 0,
        category: 'realisations',
        kind: 'PROJECT',
        images: ['https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'maison-annecy-carport',
        name: 'Maison Annecy — carport 9 kWc',
        description: 'Carport photovoltaïque + batterie 10 kWh pour une famille en montagne.',
        price: 0,
        category: 'realisations',
        kind: 'PROJECT',
        images: ['https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'commerce-grenoble',
        name: 'Commerce Grenoble — 18 kWc',
        description: 'Toiture tertiaire, optimisation d’autoconsommation sur horaires d’ouverture.',
        price: 0,
        category: 'realisations',
        kind: 'PROJECT',
        images: ['https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        slug: 'ferme-drome',
        name: 'Exploitation Drôme — 45 kWc',
        description: 'Hangar agricole, structure renforcée et monitoring multi-string.',
        price: 0,
        category: 'realisations',
        kind: 'PROJECT',
        images: ['https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?auto=format&fit=crop&w=1200&q=80'],
      },
    ];

    for (const product of products) {
      const categoryId = categoryIds.get(product.category);
      if (!categoryId) continue;
      const kind = product.kind ?? 'PRODUCT';
      await this.product.upsert({
        where: { slug: product.slug },
        create: {
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: product.price,
          categoryId,
          images: product.images,
          kind,
          published: true,
        },
        update: {
          name: product.name,
          description: product.description,
          price: product.price,
          categoryId,
          images: product.images,
          kind,
          published: true,
        },
      });
    }

    if ((await this.article.count()) === 0) {
      await this.article.create({
        data: {
          title: 'Bien démarrer avec le solaire',
          slug: 'getting-started-with-solar',
          content: 'Introduction pratique à l’énergie solaire résidentielle et professionnelle.',
          tags: ['solar'],
          published: true,
        },
      });
    }

    const defaultPages: Array<{ key: string; title: string; data: Record<string, unknown> }> = [
      {
        key: 'home',
        title: 'Accueil',
        data: {
          heroEyebrow: 'Solar énergie',
          heroTitle: 'Nous concevons avec le soleil et le métier.',
          heroLead:
            'Quelles ambitions énergétiques voulez-vous bâtir ? Nous les rendons tangibles — étude, conception et pose d’installations photovoltaïques durables pour toute la région.',
          heroImage: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80',
          aboutEyebrow: 'À propos',
          aboutTitle: 'Chaque toiture demande une vision.',
          aboutText:
            'Sur un site complexe, face à des contraintes techniques ou un budget serré : comment répondre à toutes les attentes sans compromettre le rendement ni l’architecture ? C’est là que commence notre travail.',
          expertiseEyebrow: 'Savoir-faire',
          expertiseTitle: 'Nos expertises',
          expertises: [
            { title: 'Résidentiel', text: 'Toitures individuelles, carports et solutions esthétiques intégrées.' },
            { title: 'Tertiaire', text: 'Bureaux, commerces et bâtiments industriels à forte consommation.' },
            { title: 'Autoconsommation', text: 'Dimensionnement précis pour maximiser l’usage de votre production.' },
            { title: 'Stockage', text: 'Batteries et pilotage intelligent pour la soirée et les jours gris.' },
          ],
          projectsEyebrow: 'Réalisations',
          projectsTitle: 'Nos projets récents',
          projectsText:
            'Découvrez la diversité de nos installations — maisons, villas et sites professionnels — et laissez-vous inspirer par ce que le soleil peut réellement produire chez vous.',
          storyTitle: 'Notre travail raconte l’histoire.',
          storyText: 'Voyez ce qui naît quand vision technique et collaboration se rencontrent.',
          storyImage: 'https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=1600&q=80',
          teamTitle: 'Des concepteurs exigeants. Des installateurs précis.',
          teamText:
            'Derrière chaque installation : ingénieurs, poseurs et conseillers. Notre état d’esprit ? Voir plus loin que le panneau — tout faire pour qu’un projet tienne sur le long terme.',
          whatsappEnabled: true,
          whatsappPhone: '+33 6 12 34 56 78',
          whatsappMessage: 'Bonjour, je souhaite des informations sur une installation solaire.',
        },
      },
      {
        key: 'about',
        title: 'À propos',
        data: {
          eyebrow: 'À propos',
          title: 'Des penseurs créatifs. Des installateurs techniques.',
          image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80',
          paragraphs: [
            'Solar accompagne particuliers et entreprises dans la transition énergétique — de l’étude d’ensoleillement à la mise en service. Nous combinons exigence architecturale et performance électrique pour des installations qui s’intègrent au bâti et tiennent leurs promesses année après année.',
            'Notre équipe regroupe ingénieurs photovoltaïques, chefs de chantier et conseillers énergie. Même mentalité : aller au-delà du simple devis, tout faire pour qu’un projet parte du papier et tienne sur le toit.',
          ],
        },
      },
      {
        key: 'expertises',
        title: 'Expertises',
        data: {
          eyebrow: 'Expertises',
          title: 'Du premier calcul au dernier connecteur',
          lead: 'Un parcours clair, maîtrisé de bout en bout — sans surprise sur le toit.',
          items: [
            {
              title: 'Étude & conception',
              text: 'Analyse de consommation, orientation, ombrages et choix de modules adaptés à votre toiture.',
            },
            {
              title: 'Pose & raccordement',
              text: 'Chantier soigné, étanchéité préservée, mise en conformité Consuel et raccordement réseau.',
            },
            {
              title: 'Autoconsommation',
              text: 'Optimisation du taux d’autoproduction avec pilotage des usages et éventuellement stockage.',
            },
            {
              title: 'Suivi de performance',
              text: 'Monitoring de production, alertes et maintenance pour garder le rendement dans le temps.',
            },
          ],
        },
      },
    ];

    for (const page of defaultPages) {
      await this.sitePage.upsert({
        where: { key: page.key },
        create: { key: page.key, title: page.title, data: page.data as Prisma.InputJsonValue },
        update: {},
      });
    }

    // Merge WhatsApp defaults into existing home payload without wiping edits
    const home = await this.sitePage.findUnique({ where: { key: 'home' } });
    if (home && home.data && typeof home.data === 'object' && !Array.isArray(home.data)) {
      const data = { ...(home.data as Record<string, unknown>) };
      let changed = false;
      if (!('whatsappEnabled' in data)) {
        data.whatsappEnabled = true;
        changed = true;
      }
      if (!('whatsappPhone' in data) || !data.whatsappPhone) {
        data.whatsappPhone = '+33 6 12 34 56 78';
        changed = true;
      }
      if (!('whatsappMessage' in data)) {
        data.whatsappMessage = 'Bonjour, je souhaite des informations sur une installation solaire.';
        changed = true;
      }
      if (changed) {
        await this.sitePage.update({
          where: { key: 'home' },
          data: { data: data as Prisma.InputJsonValue },
        });
      }
    }
  }
}

export class ProductDto {
  @ApiProperty({ example: 'panneau-400w' }) @IsString() slug!: string;
  @ApiProperty({ example: 'Panneau 400W' }) @IsString() name!: string;
  @ApiProperty({ example: 'Panneau monocristallin 400W' }) @IsString() description!: string;
  @ApiProperty({ example: 249.99, minimum: 0 }) @IsNumber() @Min(0) price!: number;
  @ApiProperty({ format: 'uuid' }) @IsString() categoryId!: string;
  @ApiProperty({ type: [String], example: [] }) @IsArray() @IsString({ each: true }) images!: string[];
  @ApiProperty({ example: true, description: 'Only published=true items are returned on public GET' }) @IsBoolean() published!: boolean;
  @ApiProperty({ enum: ['PRODUCT', 'PROJECT'], example: 'PRODUCT' })
  @IsString() @IsIn(['PRODUCT', 'PROJECT']) kind!: string;
}
export class ArticleDto {
  @ApiProperty({ example: 'guide-installation' }) @IsString() slug!: string;
  @ApiProperty({ example: 'Guide installation solaire' }) @IsString() title!: string;
  @ApiProperty({ example: 'Comment installer vos panneaux...' }) @IsString() content!: string;
  @ApiProperty({ example: true }) @IsBoolean() published!: boolean;
  @ApiProperty({ type: [String], example: ['guide', 'installation'] }) @IsArray() @IsString({ each: true }) tags!: string[];
}
export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  @ApiPropertyOptional({ enum: ['PRODUCT', 'PROJECT'] })
  @IsOptional() @IsString() @IsIn(['PRODUCT', 'PROJECT']) kind?: string;
}
export class UpdateArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
export class CategoryDto {
  @ApiProperty({ example: 'Panneaux' }) @IsString() name!: string;
  @ApiProperty({ example: 'panneaux' }) @IsString() slug!: string;
}
export class ProductQuery {
  @ApiPropertyOptional({ description: 'Filter by category slug' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: ['PRODUCT', 'PROJECT'] }) @IsOptional() @IsString() @IsIn(['PRODUCT', 'PROJECT']) kind?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() minPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() maxPrice?: string;
  @ApiPropertyOptional({ description: 'Search in name/description' }) @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ example: '1' }) @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional({ example: '20', description: 'Max 100' }) @IsOptional() @IsString() limit?: string;
}
export class AdminProductQuery extends ProductQuery {
  @ApiPropertyOptional({ description: 'Include unpublished items (ADMIN only)', example: 'true' })
  @IsOptional() @IsString() includeDrafts?: string;
}
export class SitePageDto {
  @ApiProperty({ example: 'Accueil' }) @IsString() title!: string;
  @ApiProperty({ description: 'Structured CMS payload' }) @IsObject() data!: Record<string, unknown>;
}

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata('permissions', permissions);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException();
    try {
      const user = await this.jwt.verifyAsync<{
        sub: string; email: string; role: string; type: string;
      }>(token, {
        secret: getJwtAccessSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (user.type !== 'access' || !isStaffRole(user.role)) {
        throw new Error('staff required');
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Staff access required');
    }
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
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const role = request.user?.role;
    if (!role || !needed.every((p) => hasPermission(role, p))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

async function recordAudit(
  authorization: string | undefined,
  action: string,
  resource: string,
  resourceId?: string,
  meta?: Record<string, unknown>,
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
      body: JSON.stringify({ action, resource, resourceId, meta }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* never block business write on audit failure */
  }
}

@Injectable()
export class CatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true, maxRetriesPerRequest: 1,
  });
  constructor(
    private readonly db: PrismaService,
    private readonly contentEvents: ContentEventsService,
  ) {}
  async onModuleInit(): Promise<void> {
    await this.redis.connect().catch(() => undefined);
    // Drop stale product lists after seed / redeploy
    await this.invalidate();
  }
  onModuleDestroy(): void { this.redis.disconnect(); }
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.redis.status === 'ready') {
      try {
        const value = await this.redis.get(key);
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (parsed !== null && typeof parsed === 'object') return parsed as T;
          await this.redis.del(key);
        }
      } catch {
        await this.redis.del(key).catch(() => undefined);
      }
    }
    const value = await load();
    if (this.redis.status === 'ready') await this.redis.set(key, JSON.stringify(value), 'EX', 300);
    return value;
  }
  private async invalidate(): Promise<void> {
    if (this.redis.status !== 'ready') return;
    const keys = await this.redis.keys('catalog:*');
    if (keys.length) await this.redis.del(...keys);
  }
  products(query: ProductQuery, opts?: { includeDrafts?: boolean }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const kind = query.kind === 'PROJECT' || query.kind === 'PRODUCT' ? query.kind : undefined;
    const where: Prisma.ProductWhereInput = {
      published: opts?.includeDrafts ? undefined : true,
      kind: kind ?? undefined,
      category: query.category ? { slug: query.category } : undefined,
      price: query.minPrice || query.maxPrice ? {
        gte: query.minPrice ? Number(query.minPrice) : undefined,
        lte: query.maxPrice ? Number(query.maxPrice) : undefined,
      } : undefined,
      OR: query.search ? [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ] : undefined,
    };
    const cacheKey = opts?.includeDrafts
      ? null
      : `catalog:products:${JSON.stringify(query)}`;
    const load = async () => {
      const [items, total] = await this.db.$transaction([
        this.db.product.findMany({
          where,
          include: { category: true },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.db.product.count({ where }),
      ]);
      return { items, total, page, limit };
    };
    if (!cacheKey) return load();
    return this.cached(cacheKey, load);
  }
  product(slug: string, opts?: { includeDrafts?: boolean }) {
    return this.db.product.findFirstOrThrow({
      where: { slug, published: opts?.includeDrafts ? undefined : true },
      include: { category: true },
    });
  }
  productById(id: string) {
    return this.db.product.findUniqueOrThrow({ where: { id }, include: { category: true } });
  }
  private async mapUnique<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Resource with this unique field already exists');
      }
      throw error;
    }
  }
  async createProduct(dto: ProductDto) {
    const value = await this.mapUnique(() => this.db.product.create({ data: dto }));
    await this.invalidate();
    this.contentEvents.publish({
      resource: value.kind === 'PROJECT' ? 'project' : 'product',
      action: 'created',
      id: value.id,
      slug: value.slug,
      kind: value.kind as 'PRODUCT' | 'PROJECT',
    });
    return value;
  }
  async updateProduct(id: string, dto: UpdateProductDto) {
    const value = await this.mapUnique(() => this.db.product.update({ where: { id }, data: dto }));
    await this.invalidate();
    this.contentEvents.publish({
      resource: value.kind === 'PROJECT' ? 'project' : 'product',
      action: 'updated',
      id: value.id,
      slug: value.slug,
      kind: value.kind as 'PRODUCT' | 'PROJECT',
    });
    return value;
  }
  async deleteProduct(id: string) {
    const existing = await this.db.product.findUnique({ where: { id } });
    await this.db.product.delete({ where: { id } });
    await this.invalidate();
    if (existing) {
      this.contentEvents.publish({
        resource: existing.kind === 'PROJECT' ? 'project' : 'product',
        action: 'deleted',
        id: existing.id,
        slug: existing.slug,
        kind: existing.kind as 'PRODUCT' | 'PROJECT',
      });
    }
    return { success: true };
  }
  articles(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    return this.db.article.findMany({
      where: { published: true },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }
  article(slug: string) { return this.db.article.findFirstOrThrow({ where: { slug, published: true } }); }
  async createArticle(dto: ArticleDto) {
    const value = await this.mapUnique(() => this.db.article.create({ data: dto }));
    this.contentEvents.publish({ resource: 'article', action: 'created', id: value.id, slug: value.slug });
    return value;
  }
  async updateArticle(id: string, dto: UpdateArticleDto) {
    const value = await this.mapUnique(() => this.db.article.update({ where: { id }, data: dto }));
    this.contentEvents.publish({ resource: 'article', action: 'updated', id: value.id, slug: value.slug });
    return value;
  }
  async deleteArticle(id: string) {
    const existing = await this.db.article.findUnique({ where: { id } });
    await this.db.article.delete({ where: { id } });
    if (existing) {
      this.contentEvents.publish({ resource: 'article', action: 'deleted', id: existing.id, slug: existing.slug });
    }
    return { success: true };
  }
  categories() { return this.db.category.findMany(); }
  async createCategory(dto: CategoryDto) {
    const value = await this.mapUnique(() => this.db.category.create({ data: dto }));
    this.contentEvents.publish({ resource: 'category', action: 'created', id: value.id, slug: value.slug });
    return value;
  }
  pages() { return this.db.sitePage.findMany({ orderBy: { key: 'asc' } }); }
  page(key: string) { return this.db.sitePage.findUniqueOrThrow({ where: { key } }); }
  async upsertPage(key: string, dto: SitePageDto) {
    const value = await this.db.sitePage.upsert({
      where: { key },
      create: { key, title: dto.title, data: dto.data as Prisma.InputJsonValue },
      update: { title: dto.title, data: dto.data as Prisma.InputJsonValue },
    });
    await this.invalidate();
    this.contentEvents.publish({ resource: 'page', action: 'updated', key });
    return value;
  }
}

export class SocialPublishDto {
  @ApiProperty({ type: [String], example: ['FACEBOOK'], description: 'Networks to publish to (phase 1: FACEBOOK only)' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'], { each: true })
  networks!: SocialNetworkCode[];

  @ApiPropertyOptional({ description: 'Create a new post even if already PUBLISHED' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly social: SocialPublishService,
  ) {}

  private assertKindPermission(role: string, kind: string | undefined) {
    const permission: Permission = kind === 'PROJECT' ? 'projects.write' : 'products.write';
    if (!hasPermission(role, permission)) {
      throw new ForbiddenException(`Missing permission ${permission}`);
    }
  }

  @Get()
  @ApiOperation({ summary: 'List published products', description: 'Public. Only `published=true`. Filter with `kind=PRODUCT|PROJECT`.' })
  @ApiResponse({ status: 200, description: '{ items, total, page, limit }' })
  list(@Query() query: ProductQuery) { return this.catalog.products(query); }

  @Get('admin/all')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all products including drafts (staff)' })
  @UseGuards(AdminGuard)
  adminList(@Query() query: AdminProductQuery, @Req() req: AuthRequest) {
    const kind = query.kind === 'PROJECT' ? 'PROJECT' : query.kind === 'PRODUCT' ? 'PRODUCT' : undefined;
    if (kind) this.assertKindPermission(req.user!.role, kind);
    else if (!hasPermission(req.user!.role, 'products.write') && !hasPermission(req.user!.role, 'projects.write')) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.catalog.products(query, { includeDrafts: true });
  }

  @Get('admin/id/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get product by id including drafts (staff)' })
  @UseGuards(AdminGuard)
  async adminOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const product = await this.catalog.productById(id);
    this.assertKindPermission(req.user!.role, product.kind);
    return product;
  }

  @Get('social/overview')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Projects + latest social publication status per network' })
  @UseGuards(AdminGuard)
  socialOverview(@Req() req: AuthRequest) {
    return this.social.overview(req.user!.role);
  }

  @Get(':id/social')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Social publication status for a PROJECT' })
  @UseGuards(AdminGuard)
  socialStatus(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.social.listForProduct(id, req.user!.role);
  }

  @Post(':id/social/publish')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Enqueue social publish for a PROJECT (Facebook Page first)' })
  @UseGuards(AdminGuard)
  async socialPublish(@Param('id') id: string, @Body() dto: SocialPublishDto, @Req() req: AuthRequest) {
    this.social.checkRateLimit(req.user!.sub);
    const result = await this.social.enqueuePublish({
      productId: id,
      networks: dto.networks,
      force: dto.force,
      requestedBy: req.user!.sub,
      role: req.user!.role,
    });
    void recordAudit(req.headers.authorization, 'project.social.publish', 'product', id, {
      networks: dto.networks,
      force: Boolean(dto.force),
    });
    return result;
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get published product by slug' })
  @ApiParam({ name: 'slug', example: 'home-solar-kit' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Not found or unpublished' })
  one(@Param('slug') slug: string) { return this.catalog.product(slug); }

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create product or project (staff)' })
  @UseGuards(AdminGuard)
  async create(@Body() dto: ProductDto, @Req() req: AuthRequest) {
    this.assertKindPermission(req.user!.role, dto.kind);
    const created = await this.catalog.createProduct(dto);
    void recordAudit(req.headers.authorization, 'product.create', 'product', created.id, { kind: dto.kind, slug: dto.slug });
    return created;
  }

  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update product or project (staff)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: AuthRequest) {
    const existing = await this.catalog.productById(id);
    this.assertKindPermission(req.user!.role, dto.kind ?? existing.kind);
    if (dto.kind && dto.kind !== existing.kind) {
      this.assertKindPermission(req.user!.role, dto.kind);
    }
    const updated = await this.catalog.updateProduct(id, dto);
    void recordAudit(req.headers.authorization, 'product.update', 'product', id, { kind: updated.kind });
    return updated;
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete product or project (staff)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const existing = await this.catalog.productById(id);
    this.assertKindPermission(req.user!.role, existing.kind);
    const result = await this.catalog.deleteProduct(id);
    void recordAudit(req.headers.authorization, 'product.delete', 'product', id, { kind: existing.kind });
    return result;
  }
}
@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @ApiOperation({ summary: 'List published articles' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Max 100' })
  @ApiResponse({ status: 200 })
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.catalog.articles(page, limit);
  }
  @Get(':slug')
  @ApiOperation({ summary: 'Get published article by slug' })
  @ApiParam({ name: 'slug', example: 'getting-started-with-solar' })
  @ApiResponse({ status: 404, description: 'Not found or unpublished' })
  one(@Param('slug') slug: string) { return this.catalog.article(slug); }
  @Post()
  @ApiBearerAuth('JWT')
  @UseGuards(AdminGuard, PermissionsGuard)
  @RequirePermissions('products.write')
  create(@Body() dto: ArticleDto, @Req() req: AuthRequest) {
    return this.catalog.createArticle(dto).then(async (created) => {
      void recordAudit(req.headers.authorization, 'article.create', 'article', created.id);
      return created;
    });
  }
  @Patch(':id')
  @ApiBearerAuth('JWT')
  @UseGuards(AdminGuard, PermissionsGuard)
  @RequirePermissions('products.write')
  @ApiParam({ name: 'id', format: 'uuid' })
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto, @Req() req: AuthRequest) {
    return this.catalog.updateArticle(id, dto).then(async (updated) => {
      void recordAudit(req.headers.authorization, 'article.update', 'article', id);
      return updated;
    });
  }
  @Delete(':id')
  @ApiBearerAuth('JWT')
  @UseGuards(AdminGuard, PermissionsGuard)
  @RequirePermissions('products.write')
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.catalog.deleteArticle(id).then(async (result) => {
      void recordAudit(req.headers.authorization, 'article.delete', 'article', id);
      return result;
    });
  }
}
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @ApiOperation({ summary: 'List categories' })
  list() { return this.catalog.categories(); }
  @Post()
  @ApiBearerAuth('JWT')
  @UseGuards(AdminGuard, PermissionsGuard)
  @RequirePermissions('products.write')
  @ApiOperation({ summary: 'Create category (catalog staff)' })
  create(@Body() dto: CategoryDto, @Req() req: AuthRequest) {
    return this.catalog.createCategory(dto).then(async (created) => {
      void recordAudit(req.headers.authorization, 'category.create', 'category', created.id);
      return created;
    });
  }
}
@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @ApiOperation({ summary: 'List CMS pages (public keys + payloads)' })
  list() { return this.catalog.pages(); }
  @Get(':key')
  @ApiOperation({ summary: 'Get CMS page by key (home|about|expertises)' })
  @ApiParam({ name: 'key', example: 'home' })
  one(@Param('key') key: string) { return this.catalog.page(key); }
  @Put(':key')
  @ApiBearerAuth('JWT')
  @UseGuards(AdminGuard, PermissionsGuard)
  @RequirePermissions('pages.write')
  @ApiOperation({ summary: 'Create or update CMS page (content staff)' })
  async upsert(@Param('key') key: string, @Body() dto: SitePageDto, @Req() req: AuthRequest) {
    const allowed = new Set(['home', 'about', 'expertises']);
    if (!allowed.has(key)) throw new BadRequestException('Unknown page key');
    const page = await this.catalog.upsertPage(key, dto);
    void recordAudit(req.headers.authorization, 'page.update', 'page', key);
    return page;
  }
}
