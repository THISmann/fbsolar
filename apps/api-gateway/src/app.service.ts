import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { service: string; message: string } {
    return {
      service: 'api-gateway',
      message: 'API Gateway is running',
    };
  }
}
