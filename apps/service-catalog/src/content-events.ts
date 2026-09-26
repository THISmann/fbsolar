import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { Channel, ChannelModel } from 'amqplib';

export type ContentResource = 'product' | 'project' | 'page' | 'category' | 'article' | 'contact' | 'media';
export type ContentAction = 'created' | 'updated' | 'deleted';

export type ContentChangedEvent = {
  resource: ContentResource;
  action: ContentAction;
  id?: string;
  slug?: string;
  key?: string;
  kind?: 'PRODUCT' | 'PROJECT';
  at: string;
};

export const CONTENT_EVENTS_EXCHANGE = 'solar.events';
export const CONTENT_CHANGED_ROUTING_KEY = 'content.changed';

@Injectable()
export class ContentEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContentEventsService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  async onModuleInit(): Promise<void> {
    if (!process.env.RABBITMQ_URL) {
      this.logger.warn('RABBITMQ_URL missing — content realtime events disabled');
      return;
    }
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(CONTENT_EVENTS_EXCHANGE, 'topic', { durable: true });
    } catch (error) {
      this.logger.warn(`RabbitMQ unavailable for content events: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  publish(event: Omit<ContentChangedEvent, 'at'> & { at?: string }): void {
    if (!this.channel) return;
    const payload: ContentChangedEvent = {
      ...event,
      at: event.at ?? new Date().toISOString(),
    };
    try {
      this.channel.publish(
        CONTENT_EVENTS_EXCHANGE,
        CONTENT_CHANGED_ROUTING_KEY,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, contentType: 'application/json' },
      );
    } catch (error) {
      this.logger.warn(`Could not publish content.changed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
