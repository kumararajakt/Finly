import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE } from './database.constants';
import { DatabaseSeedService } from './database-seed.service';
import * as schema from './schema';

export const POOL = Symbol('POOL');
export type Database = NodePgDatabase<typeof schema>;

@Injectable()
class DatabasePoolManager implements OnModuleDestroy {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        const connectionString =
          configService.getOrThrow<string>('DATABASE_URL');
        return new Pool({ connectionString });
      },
    },
    {
      provide: DRIZZLE,
      inject: [POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    DatabasePoolManager,
    DatabaseSeedService,
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
