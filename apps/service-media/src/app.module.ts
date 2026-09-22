import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard, JwtAuthGuard, MediaController, MediaService, OptionalJwtGuard, PrismaService } from './media';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController, HealthController, MediaController],
  providers: [AppService, PrismaService, MediaService, OptionalJwtGuard, JwtAuthGuard, AdminGuard],
})
export class AppModule {}
