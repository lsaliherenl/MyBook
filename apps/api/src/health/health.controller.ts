import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'ok' };
  }
}
