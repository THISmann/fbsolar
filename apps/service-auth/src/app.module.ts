import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { JwtModule } from '@nestjs/jwt';
import {
  AuthController, AuthService, AuthRateLimitService, JwtAuthGuard, PermissionsGuard, PrismaService,
  RolesGuard, SuperAdminGuard,
} from './auth';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController, HealthController, AuthController],
  providers: [
    AppService,
    PrismaService,
    AuthService,
    AuthRateLimitService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    SuperAdminGuard,
  ],
})
export class AppModule {}
