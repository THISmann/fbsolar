import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { JwtModule } from '@nestjs/jwt';
import {
  ChatGateway, InteractionController, InteractionService, JwtAdminGuard, PrismaService, RateLimitService,
} from './interaction';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController, HealthController, InteractionController],
  providers: [AppService, PrismaService, InteractionService, RateLimitService, JwtAdminGuard, ChatGateway],
})
export class AppModule {}
