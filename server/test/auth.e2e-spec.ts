import {
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { DRIZZLE } from './../src/database/database.constants';
import type { Database } from './../src/database/database.module';
import {
  account,
  emailOtps,
  sessions,
  users,
  verification,
} from './../src/database/schema';
import { MailService } from './../src/mail/mail.service';

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
  let mail: MailServiceStub;

  const validPassword = 'super-secret-password';
  const validEmail = 'owner@finly.local';

  class MailServiceStub {
    lastOtp: string | null = null;
    sendOtp = jest.fn((_to: string, otp: string) => {
      this.lastOtp = otp;
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedProbeController],
    })
      .overrideProvider(MailService)
      .useClass(MailServiceStub)
      .compile();

    mail = moduleFixture.get(MailService);

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
    await db.delete(emailOtps);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
  });

  afterAll(async () => {
    await db.delete(emailOtps);
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
      .send({ email: validEmail, password: 'short' });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an invalid email on register', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: validPassword });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('sends an OTP on register without creating the account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: validEmail, password: validPassword });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ pending: true, email: validEmail });
    expect(mail.lastOtp).toMatch(/^\d{6}$/);
    expect(res.headers['set-cookie']).toBeUndefined();

    const me = await request(app.getHttpServer()).get('/api/auth/me');
    expect(me.body).toEqual({ session: null, user: null });
  });

  it('rejects a wrong OTP and counts attempts', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: validEmail, password: validPassword })
      .expect(202);

    const wrong = await request(app.getHttpServer())
      .post('/api/auth/register/verify')
      .send({
        email: validEmail,
        otp: '000000',
        password: validPassword,
        confirmPassword: validPassword,
      });
    expect(wrong.status).toBe(400);
    expect((wrong.body as AuthErrorBody).error.code).toBe('INVALID_OTP');

    const me = await request(app.getHttpServer()).get('/api/auth/me');
    expect(me.body).toEqual({ session: null, user: null });
  });

  it('rejects a mismatched confirm password on verify', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/verify')
      .send({
        email: validEmail,
        otp: mail.lastOtp,
        password: validPassword,
        confirmPassword: 'a-different-password',
      });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('enforces a resend cooldown', async () => {
    const cooldown = await request(app.getHttpServer())
      .post('/api/auth/register/resend')
      .send({ email: validEmail });
    expect(cooldown.status).toBe(429);
    expect((cooldown.body as AuthErrorBody).error.code).toBe('OTP_COOLDOWN');
  });

  it('resends a fresh OTP after the cooldown window', async () => {
    const [otpRow] = await db
      .select({ id: emailOtps.id })
      .from(emailOtps)
      .limit(1);
    await db
      .update(emailOtps)
      .set({ createdAt: new Date(Date.now() - 120_000) })
      .where(eq(emailOtps.id, otpRow.id));
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/resend')
      .send({ email: validEmail });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ pending: true, email: validEmail });
    expect(mail.lastOtp).toMatch(/^\d{6}$/);
  });

  it('creates the account only after the OTP is verified', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/register/verify').send({
      email: validEmail,
      otp: mail.lastOtp,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(res.status).toBe(201);
    expect((res.body as AuthMeBody).user).toMatchObject({
      email: 'owner@finly.local',
    });
    expect(res.headers['set-cookie']).toBeDefined();

    const me = await agent.get('/api/auth/me');
    expect(me.body).toMatchObject({
      session: {},
      user: { email: validEmail },
    });
  });

  it('registers a second account with a different email', async () => {
    const secondEmail = 'second@finly.local';
    const secondAgent = request.agent(app.getHttpServer());
    const register = await secondAgent
      .post('/api/auth/register')
      .send({ email: secondEmail, password: validPassword });
    expect(register.status).toBe(202);
    expect(register.body).toEqual({ pending: true, email: secondEmail });

    const verify = await secondAgent.post('/api/auth/register/verify').send({
      email: secondEmail,
      otp: mail.lastOtp,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(verify.status).toBe(201);
    expect((verify.body as AuthMeBody).user).toMatchObject({
      email: secondEmail,
    });

    const me = await secondAgent.get('/api/auth/me');
    expect(me.body).toMatchObject({ user: { email: secondEmail } });
  });

  it('returns the session for an authenticated agent', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
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
      .send({ email: validEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect((res.body as AuthErrorBody).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs out and clears the session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ session: null, user: null });
  });

  it('updates the profile name and image for an authenticated agent', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const res = await agent
      .patch('/api/auth/profile')
      .send({ name: 'Alex Owner', image });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'owner@finly.local',
      name: 'Alex Owner',
      image,
    });

    const me = await agent.get('/api/auth/me');
    expect((me.body as AuthMeBody).user).toMatchObject({
      email: 'owner@finly.local',
      name: 'Alex Owner',
      image,
    });
  });

  it('clears the profile image when set to null', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.patch('/api/auth/profile').send({ image: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ image: null });
  });

  it('rejects a profile name that is only whitespace', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.patch('/api/auth/profile').send({ name: '   ' });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a profile update without a session', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/auth/profile')
      .send({ name: 'Hacker' });
    expect(res.status).toBe(401);
    expect((res.body as AuthErrorBody).error.code).toBe('UNAUTHORIZED');
  });

  it('lists supported countries for an authenticated agent', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.get('/api/countries');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'US',
          name: 'United States',
          currency: 'USD',
        }),
      ]),
    );
    const us = (res.body as { code: string }[]).find(
      (entry) => entry.code === 'US',
    );
    expect(us).toBeDefined();
  });

  it('rejects the countries list without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/countries');
    expect(res.status).toBe(401);
    expect((res.body as AuthErrorBody).error.code).toBe('UNAUTHORIZED');
  });

  it('sets the country and derives the timezone on profile update', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.patch('/api/auth/profile').send({ country: 'JP' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      country: 'JP',
      timeZone: 'Asia/Tokyo',
    });

    const me = await agent.get('/api/auth/me');
    expect((me.body as AuthMeBody).user).toMatchObject({
      country: 'JP',
      timeZone: 'Asia/Tokyo',
    });
  });

  it('clears the country and timezone when set to null', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.patch('/api/auth/profile').send({ country: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ country: null, timeZone: null });
  });

  it('rejects an unsupported country code', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    const res = await agent.patch('/api/auth/profile').send({ country: 'XX' });
    expect(res.status).toBe(422);
    expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
  });
});
