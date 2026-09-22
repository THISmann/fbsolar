import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { service: string; message: string } {
    return {
      service: 'service-interaction',
      message: 'Interaction Service is running',
    };
  }
}
