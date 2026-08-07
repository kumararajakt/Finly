import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('/api/health responds with ok or a structured DB error', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body).toEqual({
        error: { message: 'Database is unavailable.', code: 'DB_UNAVAILABLE' },
      });
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
