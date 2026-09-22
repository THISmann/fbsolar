import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminGuard, ArticlesController, CatalogService, CategoriesController, PagesController, PermissionsGuard,
  PrismaService, ProductsController,
} from './catalog';
import {
  FacebookPagePublisher, InstagramPublisher, LinkedInPublisher, PRISMA, SocialPublishService,
} from './social';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController, HealthController, ProductsController, ArticlesController, CategoriesController, PagesController],
  providers: [
    AppService,
    PrismaService,
    { provide: PRISMA, useExisting: PrismaService },
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
