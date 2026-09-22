import {
  BadRequestException,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'minio';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Response } from 'express';
import { JWT_AUDIENCE, JWT_ISSUER, getJwtAccessSecret, isStaffRole } from '@solar/shared';
import { PrismaClient } from './generated/prisma';

type JwtPayload = { sub: string; role: string; type: string };
type AuthRequest = { headers: { authorization?: string }; user?: JwtPayload };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return true;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getJwtAccessSecret(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (payload.type !== 'access') throw new Error('Wrong token type');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly optional: OptionalJwtGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.optional.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly optional: OptionalJwtGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.optional.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user || !isStaffRole(request.user.role)) {
      throw new UnauthorizedException('Staff access required');
    }
    return true;
  }
}

@Injectable()
export class MediaService {
  private readonly bucket = process.env.MINIO_BUCKET ?? 'solar-assets';
  private readonly publicBase = (process.env.MEDIA_PUBLIC_BASE_URL ?? 'http://localhost/api/media').replace(/\/$/, '');
  private readonly minio = new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });

  constructor(private readonly db: PrismaService) {}

  publicUrl(id: string): string {
    return `${this.publicBase}/file/${id}`;
  }

  private validate(file: Express.Multer.File): void {
    if (!file?.buffer || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File is required and must be at most 10MB');
    }
    const b = file.buffer;
    const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const gif = b.subarray(0, 3).toString() === 'GIF';
    const webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
    const pdf = b.subarray(0, 5).toString() === '%PDF-';
    if (!(png || jpeg || gif || webp || pdf)) {
      throw new BadRequestException('Only valid images and PDF files are allowed');
    }
    if (!(file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
      throw new BadRequestException('Unsupported MIME type');
    }
  }

  async upload(file: Express.Multer.File, uploadedBy?: string) {
    this.validate(file);
    const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extname(file.originalname) || ''}`;
    await this.minio.putObject(this.bucket, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    const saved = await this.db.mediaFile.create({
      data: {
        objectKey,
        bucket: this.bucket,
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
        uploadedBy,
      },
    });
    return { ...saved, url: this.publicUrl(saved.id) };
  }

  async url(id: string, user: JwtPayload) {
    const file = await this.db.mediaFile.findUniqueOrThrow({ where: { id } });
    if (!isStaffRole(user.role) && file.uploadedBy !== user.sub) {
      throw new UnauthorizedException('You do not have access to this media file');
    }
    return {
      id,
      url: await this.minio.presignedGetObject(file.bucket, file.objectKey, 3600),
      publicUrl: this.publicUrl(id),
      expiresIn: 3600,
    };
  }

  async streamTo(id: string, res: Response): Promise<void> {
    const file = await this.db.mediaFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Media not found');
    const stream = await this.minio.getObject(file.bucket, file.objectKey);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    stream.pipe(res);
  }

  async remove(id: string) {
    const file = await this.db.mediaFile.findUniqueOrThrow({ where: { id } });
    await this.minio.removeObject(file.bucket, file.objectKey);
    await this.db.mediaFile.delete({ where: { id } });
    return { success: true };
  }
}

@ApiTags('media')
@Controller(['', 'media'])
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload image or PDF',
    description:
      'JWT required. Max 10MB. Magic-bytes validated (PNG/JPEG/GIF/WEBP/PDF). Returns a stable public `url` for CMS use.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image or PDF file' },
      },
    },
  })
  @ApiBearerAuth('JWT')
  @ApiResponse({ status: 201, description: 'Media metadata created' })
  @ApiResponse({ status: 400, description: 'Invalid file / MIME / size' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Req() request: AuthRequest) {
    return this.media.upload(file, request.user!.sub);
  }

  @Get('file/:id')
  @ApiOperation({
    summary: 'Public file stream',
    description: 'Stable public URL for images stored in MinIO (no auth). Used by the website CMS.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Binary file stream' })
  @ApiResponse({ status: 404, description: 'Not found' })
  file(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return this.media.streamTo(id, res);
  }

  @Get(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get presigned download URL',
    description: 'Owner or staff. Presigned URL expires in 1 hour. Also returns stable `publicUrl`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: '{ id, url, publicUrl, expiresIn }' })
  @ApiResponse({ status: 401, description: 'Unauthenticated or not owner' })
  @UseGuards(JwtAuthGuard)
  get(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.media.url(id, request.user!);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete media file (staff)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Staff access required' })
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.media.remove(id);
  }
}
