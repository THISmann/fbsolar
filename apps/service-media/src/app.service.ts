import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { service: string; message: string } {
    return {
      service: 'service-media',
      message: 'Media Service is running',
    };
  }
}
