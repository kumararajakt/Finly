import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  async check(): Promise<{ status: string; db: string }> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database is unavailable.',
        code: 'DB_UNAVAILABLE',
      });
    }
  }
}
