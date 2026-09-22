import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export type RequestWithId = Request & { requestId?: string };

export function correlationMiddleware(request: RequestWithId, response: Response, next: NextFunction): void {
  const supplied = request.header('x-request-id');
  request.requestId = supplied && supplied.length <= 128 ? supplied : randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  next();
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message = typeof detail === 'string'
      ? detail
      : (detail as { message?: string | string[] }).message ?? 'Request failed';
    response.status(status).json({
      statusCode: status,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    });
  }
}
