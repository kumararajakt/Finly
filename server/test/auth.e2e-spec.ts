import {
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { DRIZZLE } from './../src/database/database.constants';
import type { Database } from './../src/database/database.module';
import {
  account,
  sessions,
  users,
  verification,
} from './../src/database/schema';

@Controller('protected-probe')
class ProtectedProbeController {
  @Get()
  probe(): { ok: boolean } {
    return { ok: true };
  }
}

interface AuthUserBody {
  email: string;
}

interface AuthMeBody {
  session: { id: string; expiresAt: string } | null;
  user: AuthUserBody | null;
}

interface AuthErrorBody {
  error: { message: string; code: string };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  const validPassword = 'super-secret-password';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    await app.init();

    db = moduleFixture.get<Database>(DRIZZLE);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
  });

  afterAll(async () => {
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  it('GET /api/health stays public', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect([200, 503]).toContain(res.status);
  });

  it('rejects unauthenticated requests on protected routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/protected-probe');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Authentication required.', code: 'UNAUTHORIZED' },
    });
  });

  it('GET /api/auth/me returns no session before registering', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ session: null, user: null });
  });

  it('rejects a too-short password on register', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ password: 'short' });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('registers the first account and sets a session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ password: validPassword });
    expect(res.status).toBe(201);
    expect((res.body as AuthMeBody).user).toMatchObject({
      email: 'owner@finly.local',
    });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('blocks a second registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ password: validPassword });
    expect(res.status).toBe(409);
    expect((res.body as AuthErrorBody).error.code).toBe('ALREADY_REGISTERED');
  });

  it('returns the session for an authenticated agent', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ password: validPassword })
      .expect(200);

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect((res.body as AuthMeBody).user).toMatchObject({
      email: 'owner@finly.local',
    });

    const probe = await agent.get('/api/protected-probe');
    expect(probe.status).toBe(200);
    expect(probe.body).toEqual({ ok: true });
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect((res.body as AuthErrorBody).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs out and clears the session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ password: validPassword })
      .expect(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ session: null, user: null });
  });
});
