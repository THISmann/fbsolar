import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { service: string; message: string } {
    return {
      service: 'service-catalog',
      message: 'Catalog Service is running',
    };
  }
}
