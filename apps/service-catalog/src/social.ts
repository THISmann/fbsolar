import {
  BadRequestException, ForbiddenException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { hasPermission } from '@solar/shared';
import { PrismaClient, SocialNetwork, SocialPublishStatus } from './generated/prisma';

/** Nest DI token — avoids circular import with catalog.ts */
export const PRISMA = 'PRISMA';

export const SOCIAL_QUEUE = 'solar.social.publish';
export const SOCIAL_EXCHANGE = 'solar.events';
export const SOCIAL_ROUTING_KEY = 'social.publish';

export type SocialNetworkCode = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN';

export type PublishPayload = {
  title: string;
  description: string;
  imageUrls: string[];
  permalink: string;
};

export type PublishResult = { externalId: string };

export interface SocialNetworkPublisher {
  readonly network: SocialNetworkCode;
  isConfigured(): boolean;
  publish(payload: PublishPayload): Promise<PublishResult>;
}

type SocialJob = {
  publicationId: string;
  attempt: number;
};

const MAX_ATTEMPTS = 3;
const CAPTION_MAX = 2000;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildCaption(payload: PublishPayload): string {
  const parts = [
    payload.title.trim(),
    payload.description.trim(),
    payload.permalink ? `En savoir plus : ${payload.permalink}` : '',
  ].filter(Boolean);
  return truncate(parts.join('\n\n'), CAPTION_MAX);
}

function publicSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

@Injectable()
export class FacebookPagePublisher implements SocialNetworkPublisher {
  readonly network = 'FACEBOOK' as const;
  private readonly logger = new Logger(FacebookPagePublisher.name);
  private readonly graphVersion = process.env.FACEBOOK_GRAPH_VERSION?.trim() || 'v21.0';

  isConfigured(): boolean {
    return Boolean(process.env.FACEBOOK_PAGE_ID?.trim() && process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim());
  }

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
    if (!pageId || !token) {
      throw new Error('Facebook Page credentials are not configured (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN)');
    }

    const caption = buildCaption(payload);
    const imageUrl = payload.imageUrls.find((url) => /^https?:\/\//i.test(url));
    const base = `https://graph.facebook.com/${this.graphVersion}/${encodeURIComponent(pageId)}`;

    if (imageUrl) {
      const body = new URLSearchParams({
        url: imageUrl,
        caption,
        access_token: token,
      });
      const response = await fetch(`${base}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(this.metaError(json, `Facebook photos HTTP ${response.status}`));
      }
      const externalId = this.extractId(json);
      if (!externalId) throw new Error('Facebook photos response missing id');
      this.logger.log(`Published Facebook photo post ${externalId}`);
      return { externalId };
    }

    const body = new URLSearchParams({
      message: caption,
      link: payload.permalink,
      access_token: token,
    });
    const response = await fetch(`${base}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(this.metaError(json, `Facebook feed HTTP ${response.status}`));
    }
    const externalId = this.extractId(json);
    if (!externalId) throw new Error('Facebook feed response missing id');
    this.logger.log(`Published Facebook feed post ${externalId}`);
    return { externalId };
  }

  private extractId(json: unknown): string | null {
    if (!json || typeof json !== 'object') return null;
    const row = json as Record<string, unknown>;
    if (typeof row.post_id === 'string' && row.post_id) return row.post_id;
    if (typeof row.id === 'string' && row.id) return row.id;
    return null;
  }

  private metaError(json: unknown, fallback: string): string {
    if (!json || typeof json !== 'object') return fallback;
    const err = (json as { error?: { message?: string; code?: number } }).error;
    if (err?.message) return `Facebook API: ${err.message}${err.code != null ? ` (${err.code})` : ''}`;
    return fallback;
  }
}

/** Placeholder adapters — phase 2. */
@Injectable()
export class InstagramPublisher implements SocialNetworkPublisher {
  readonly network = 'INSTAGRAM' as const;
  isConfigured(): boolean { return false; }
  async publish(_payload: PublishPayload): Promise<PublishResult> {
    throw new Error('Instagram publishing is not enabled yet');
  }
}

@Injectable()
export class LinkedInPublisher implements SocialNetworkPublisher {
  readonly network = 'LINKEDIN' as const;
  isConfigured(): boolean { return false; }
  async publish(_payload: PublishPayload): Promise<PublishResult> {
    throw new Error('LinkedIn publishing is not enabled yet');
  }
}

@Injectable()
export class SocialPublishService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialPublishService.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private readonly publishers: Map<SocialNetworkCode, SocialNetworkPublisher>;
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    facebook: FacebookPagePublisher,
    instagram: InstagramPublisher,
    linkedin: LinkedInPublisher,
  ) {
    this.publishers = new Map<SocialNetworkCode, SocialNetworkPublisher>([
      [facebook.network, facebook],
      [instagram.network, instagram],
      [linkedin.network, linkedin],
    ]);
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.RABBITMQ_URL) {
      this.logger.warn('RABBITMQ_URL missing — social jobs will run inline');
      return;
    }
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(SOCIAL_EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(SOCIAL_QUEUE, { durable: true });
      await this.channel.bindQueue(SOCIAL_QUEUE, SOCIAL_EXCHANGE, SOCIAL_ROUTING_KEY);
      await this.channel.prefetch(1);
      await this.channel.consume(SOCIAL_QUEUE, (msg) => {
        void this.onMessage(msg);
      });
      this.logger.log(`Consuming ${SOCIAL_QUEUE}`);
    } catch (error) {
      this.logger.warn(`RabbitMQ unavailable for social: ${error instanceof Error ? error.message : 'unknown'}`);
      this.channel = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  checkRateLimit(actorId: string, limit = 10, windowMs = 60_000): void {
    const key = `social:${actorId}`;
    const now = Date.now();
    const recent = (this.rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      throw new BadRequestException('Too many social publish requests — try again later');
    }
    recent.push(now);
    this.rateBuckets.set(key, recent);
  }

  async listForProduct(productId: string, role: string) {
    const product = await this.db.product.findUniqueOrThrow({ where: { id: productId } });
    if (product.kind !== 'PROJECT') throw new BadRequestException('Only PROJECT items can be shared socially');
    if (!hasPermission(role, 'projects.write')) throw new ForbiddenException('Missing permission projects.write');
    const items = await this.db.socialPublication.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return { productId, items: items.map((row) => this.toDto(row)) };
  }

  async overview(role: string) {
    if (!hasPermission(role, 'projects.write')) {
      throw new ForbiddenException('Missing permission projects.write');
    }
    const projects = await this.db.product.findMany({
      where: { kind: 'PROJECT' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        published: true,
        updatedAt: true,
      },
    });
    const pubs = await this.db.socialPublication.findMany({
      where: { productId: { in: projects.map((p) => p.id) } },
      orderBy: { createdAt: 'desc' },
    });

    const latestByProduct = new Map<string, Map<string, ReturnType<SocialPublishService['toDto']>>>();
    for (const row of pubs) {
      let byNet = latestByProduct.get(row.productId);
      if (!byNet) {
        byNet = new Map();
        latestByProduct.set(row.productId, byNet);
      }
      if (!byNet.has(row.network)) {
        byNet.set(row.network, this.toDto(row));
      }
    }

    const facebookReady = this.publishers.get('FACEBOOK')?.isConfigured() ?? false;

    return {
      networks: [
        { id: 'FACEBOOK' as const, label: 'Facebook Page', enabled: true, configured: facebookReady },
        { id: 'INSTAGRAM' as const, label: 'Instagram', enabled: false, configured: false },
        { id: 'LINKEDIN' as const, label: 'LinkedIn', enabled: false, configured: false },
      ],
      items: projects.map((project) => {
        const byNet = latestByProduct.get(project.id);
        return {
          product: project,
          publications: {
            FACEBOOK: byNet?.get('FACEBOOK') ?? null,
            INSTAGRAM: byNet?.get('INSTAGRAM') ?? null,
            LINKEDIN: byNet?.get('LINKEDIN') ?? null,
          },
        };
      }),
    };
  }

  async enqueuePublish(input: {
    productId: string;
    networks: SocialNetworkCode[];
    force?: boolean;
    requestedBy?: string;
    role: string;
  }) {
    if (!hasPermission(input.role, 'projects.write')) {
      throw new ForbiddenException('Missing permission projects.write');
    }
    const product = await this.db.product.findUniqueOrThrow({ where: { id: input.productId } });
    if (product.kind !== 'PROJECT') {
      throw new BadRequestException('Only PROJECT realizations can be published to social networks');
    }
    if (!product.description?.trim() && (!product.images || product.images.length === 0)) {
      throw new BadRequestException('Project needs a description or at least one image before publishing');
    }

    const networks = [...new Set(input.networks)];
    if (!networks.length) throw new BadRequestException('networks is required');

    const created = [];
    for (const network of networks) {
      const publisher = this.publishers.get(network);
      if (!publisher) throw new BadRequestException(`Unsupported network ${network}`);
      if (network !== 'FACEBOOK') {
        throw new BadRequestException(`${network} publishing is not enabled yet (phase 2)`);
      }
      if (!publisher.isConfigured()) {
        throw new BadRequestException(
          'Facebook is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN on the catalog service.',
        );
      }

      const latest = await this.db.socialPublication.findFirst({
        where: { productId: product.id, network: network as SocialNetwork },
        orderBy: { createdAt: 'desc' },
      });

      if (latest?.status === SocialPublishStatus.PENDING) {
        created.push(this.toDto(latest));
        continue;
      }
      if (latest?.status === SocialPublishStatus.PUBLISHED && !input.force) {
        created.push(this.toDto(latest));
        continue;
      }

      const row = await this.db.socialPublication.create({
        data: {
          productId: product.id,
          network: network as SocialNetwork,
          status: SocialPublishStatus.PENDING,
          requestedBy: input.requestedBy,
          attempts: 0,
        },
      });
      await this.dispatch({ publicationId: row.id, attempt: 1 });
      created.push(this.toDto(row));
    }

    return { accepted: true, items: created };
  }

  private toDto(row: {
    id: string;
    productId: string;
    network: SocialNetwork;
    status: SocialPublishStatus;
    externalPostId: string | null;
    error: string | null;
    requestedBy: string | null;
    attempts: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
    let postUrl: string | null = null;
    if (row.network === SocialNetwork.FACEBOOK && row.externalPostId) {
      postUrl = pageId
        ? `https://www.facebook.com/${pageId}/posts/${row.externalPostId.replace(`${pageId}_`, '')}`
        : `https://www.facebook.com/${row.externalPostId}`;
    }
    return {
      id: row.id,
      productId: row.productId,
      network: row.network,
      status: row.status,
      externalPostId: row.externalPostId,
      postUrl,
      error: row.error,
      requestedBy: row.requestedBy,
      attempts: row.attempts,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async dispatch(job: SocialJob): Promise<void> {
    const body = Buffer.from(JSON.stringify(job));
    if (this.channel) {
      try {
        this.channel.publish(SOCIAL_EXCHANGE, SOCIAL_ROUTING_KEY, body, {
          persistent: true,
          contentType: 'application/json',
        });
        return;
      } catch (error) {
        this.logger.warn(`Queue publish failed, running inline: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
    // Inline fallback when RabbitMQ is down
    setImmediate(() => {
      void this.processJob(job);
    });
  }

  private async onMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) return;
    try {
      const job = JSON.parse(msg.content.toString()) as SocialJob;
      await this.processJob(job);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(`Social job failed: ${error instanceof Error ? error.message : 'unknown'}`);
      this.channel.nack(msg, false, false);
    }
  }

  async processJob(job: SocialJob): Promise<void> {
    const publication = await this.db.socialPublication.findUnique({ where: { id: job.publicationId } });
    if (!publication) return;
    if (publication.status === SocialPublishStatus.PUBLISHED) return;

    const product = await this.db.product.findUnique({ where: { id: publication.productId } });
    if (!product || product.kind !== 'PROJECT') {
      await this.db.socialPublication.update({
        where: { id: publication.id },
        data: { status: SocialPublishStatus.FAILED, error: 'Product missing or not a PROJECT' },
      });
      return;
    }

    const publisher = this.publishers.get(publication.network as SocialNetworkCode);
    if (!publisher) {
      await this.db.socialPublication.update({
        where: { id: publication.id },
        data: { status: SocialPublishStatus.FAILED, error: `No publisher for ${publication.network}` },
      });
      return;
    }

    await this.db.socialPublication.update({
      where: { id: publication.id },
      data: { attempts: { increment: 1 }, status: SocialPublishStatus.PENDING, error: null },
    });

    try {
      const result = await publisher.publish({
        title: product.name,
        description: product.description,
        imageUrls: product.images ?? [],
        permalink: `${publicSiteUrl()}/projets/${encodeURIComponent(product.slug)}`,
      });
      await this.db.socialPublication.update({
        where: { id: publication.id },
        data: {
          status: SocialPublishStatus.PUBLISHED,
          externalPostId: result.externalId,
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Publish failed';
      const attempts = (publication.attempts ?? 0) + 1;
      if (attempts < MAX_ATTEMPTS) {
        await this.db.socialPublication.update({
          where: { id: publication.id },
          data: { status: SocialPublishStatus.PENDING, error: message },
        });
        const delayMs = attempts * 2000;
        setTimeout(() => {
          void this.dispatch({ publicationId: publication.id, attempt: attempts + 1 });
        }, delayMs);
      } else {
        await this.db.socialPublication.update({
          where: { id: publication.id },
          data: { status: SocialPublishStatus.FAILED, error: message },
        });
      }
    }
  }
}
