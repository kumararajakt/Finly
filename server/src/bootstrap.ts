import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLogging } from './common/middleware/request-logging';
import { DRIZZLE } from './database/database.constants';
import type { Database } from './database/database.module';

export interface BootstrapOptions {
  migrate?: boolean;
}

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(process.cwd(), 'drizzle'),
    path.join(process.cwd(), 'server', 'drizzle'),
    path.resolve(__dirname, '..', 'drizzle'),
    path.resolve(__dirname, '..', '..', 'drizzle'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder();

function corsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function runMigrations(app: INestApplication): Promise<void> {
  const db = app.get<Database>(DRIZZLE);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins().length > 0 ? corsOrigins() : true,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.use(requestLogging);

  if (options.migrate) {
    try {
      await runMigrations(app);
    } catch (error) {
      console.warn(
        `Migrations skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return app;
}
