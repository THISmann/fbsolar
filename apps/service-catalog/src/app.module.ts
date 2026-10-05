import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminGuard, ArticlesController, CatalogService, CategoriesController, PagesController, PermissionsGuard,
  PrismaService, ProductsController,
} from './catalog';
import { ContentEventsService } from './content-events';
import { SeoController, SeoService } from './seo';
import {
  FacebookPagePublisher, InstagramPublisher, LinkedInPublisher, PRISMA, SocialPublishService,
} from './social';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController, HealthController, ProductsController, ArticlesController, CategoriesController, PagesController, SeoController],
  providers: [
    AppService,
    SeoService,
    PrismaService,
    { provide: PRISMA, useExisting: PrismaService },
    ContentEventsService,
    CatalogService,
    AdminGuard,
    PermissionsGuard,
    FacebookPagePublisher,
    InstagramPublisher,
    LinkedInPublisher,
    SocialPublishService,
  ],
})
export class AppModule {}
