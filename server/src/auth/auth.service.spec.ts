import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { hashOtp, OTP_MAX_ATTEMPTS } from './otp';

const EMAIL = 'owner@finly.local';

function futureDate(ms: number): Date {
  return new Date(Date.now() + ms);
}

function pastDate(ms: number): Date {
  return new Date(Date.now() - ms);
}

const countChain = (count: number) => ({
  from: jest.fn(() => Promise.resolve([{ count }])),
});

const otpChain = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve(rows)),
      })),
    })),
  })),
});

function makeDb() {
  const db = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  db.insert.mockImplementation(() => ({
    values: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([{}]),
      onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
    })),
  }));
  db.update.mockImplementation(() => ({
    set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  }));
  db.delete.mockImplementation(() => ({
    where: jest.fn().mockResolvedValue(undefined),
  }));
  return db;
}

function otpRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'otp-1',
    email: EMAIL,
    otpHash: hashOtp(EMAIL, '123456'),
    attempts: 0,
    expiresAt: futureDate(60_000),
    createdAt: pastDate(1_000),
    ...overrides,
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  const mail = {
    sendOtp: jest.fn<Promise<void>, [to: string, otp: string]>(),
  };
  const seed = {
    seedUserDefaults: jest.fn<Promise<void>, [userId: string]>(),
  };
  const auth = {
    api: {
      signUpEmail: jest.fn<
        Promise<{
          headers: { getSetCookie: () => string[] } | undefined;
          response: { user?: unknown };
        }>,
        [body: Record<string, unknown>]
      >(),
    },
  };
  const service = new AuthService(db as never, mail as never, seed as never);
  (service as unknown as { auth: typeof auth }).auth = auth;
  (service as unknown as { isAPIError: (e: unknown) => boolean }).isAPIError =
    () => false;
  return { service, mail, seed, auth };
}

function makeResponse() {
  const setHeader = jest.fn();
  return {
    setHeader,
    response: { setHeader } as unknown as Response,
  };
}

describe('AuthService OTP registration', () => {
  describe('register', () => {
    it('sends an OTP for the normalized email without creating a user', async () => {
      const db = makeDb();
      const { service, mail } = makeService(db);
      const inserted: unknown[] = [];
      db.insert.mockImplementation(() => ({
        values: (values: unknown) => {
          inserted.push(values);
          return { returning: jest.fn().mockResolvedValue([values]) };
        },
      }));

      const result = await service.register('  Owner@Finly.LOCAL ');

      expect(result).toEqual({ pending: true, email: EMAIL });
      expect(mail.sendOtp).toHaveBeenCalledTimes(1);
      const [, sentOtp] = mail.sendOtp.mock.calls[0];
      expect(sentOtp).toMatch(/^\d{6}$/);
      expect(inserted[0]).toMatchObject({
        email: EMAIL,
        otpHash: hashOtp(EMAIL, sentOtp),
      });
      const insertedRow = inserted[0] as { expiresAt: Date };
      expect(insertedRow.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('issues an OTP even when another account already exists', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(countChain(1));
      const { service, mail } = makeService(db);

      const result = await service.register(EMAIL);

      expect(result).toEqual({ pending: true, email: EMAIL });
      expect(mail.sendOtp).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendOtp', () => {
    it('respects the resend cooldown', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        otpChain([otpRow({ createdAt: new Date() })]),
      );
      const { service, mail } = makeService(db);

      await expect(service.resendOtp(EMAIL)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { code: 'OTP_COOLDOWN' },
      });
      expect(mail.sendOtp).not.toHaveBeenCalled();
    });

    it('issues a fresh code after the cooldown window', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        otpChain([otpRow({ createdAt: pastDate(120_000) })]),
      );
      const { service, mail } = makeService(db);

      const result = await service.resendOtp(EMAIL);

      expect(result).toEqual({ pending: true, email: EMAIL });
      const [, sentOtp] = mail.sendOtp.mock.calls[0];
      expect(sentOtp).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyOtp', () => {
    it('rejects an expired code', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        otpChain([otpRow({ expiresAt: pastDate(1) })]),
      );
      const { service, auth } = makeService(db);

      await expect(
        service.verifyOtp(EMAIL, '123456', 'password', makeResponse().response),
      ).rejects.toMatchObject({ response: { code: 'OTP_EXPIRED' } });
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });

    it('rejects a wrong code and counts the attempt', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(otpChain([otpRow()]));
      const { service, auth } = makeService(db);
      const updated: unknown[] = [];
      db.update.mockImplementation(() => ({
        set: (set: unknown) => {
          updated.push(set);
          return { where: jest.fn().mockResolvedValue(undefined) };
        },
      }));

      await expect(
        service.verifyOtp(EMAIL, '000000', 'password', makeResponse().response),
      ).rejects.toMatchObject({ response: { code: 'INVALID_OTP' } });
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
      expect(updated[0]).toHaveProperty('attempts');
    });

    it('locks out after exhausting attempts', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        otpChain([otpRow({ attempts: OTP_MAX_ATTEMPTS })]),
      );
      const { service, auth } = makeService(db);

      await expect(
        service.verifyOtp(EMAIL, '123456', 'password', makeResponse().response),
      ).rejects.toMatchObject({ response: { code: 'OTP_TOO_MANY_ATTEMPTS' } });
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('creates the account, sets the session, and marks the email verified', async () => {
      const db = makeDb();
      db.select
        .mockReturnValueOnce(otpChain([otpRow()]))
        .mockReturnValueOnce(countChain(13));
      const { service, auth, seed } = makeService(db);
      auth.api.signUpEmail.mockResolvedValue({
        headers: { getSetCookie: () => ['finly_session=abc'] },
        response: { user: { id: 'u1', email: EMAIL } },
      });
      const { setHeader, response } = makeResponse();

      const result = await service.verifyOtp(
        EMAIL,
        '123456',
        'password',
        response,
      );

      expect(result).toEqual({ user: { id: 'u1', email: EMAIL } });
      const signUpBody = auth.api.signUpEmail.mock.calls[0][0];
      expect(signUpBody).toMatchObject({
        body: { email: EMAIL, password: 'password' },
      });
      expect(setHeader).toHaveBeenCalledWith('Set-Cookie', expect.any(Array));
      expect(db.update).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
      expect(seed.seedUserDefaults).toHaveBeenCalledWith('u1');
    });

    it('maps a duplicate email on sign-up to a conflict', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(otpChain([otpRow()]));
      const { service, auth } = makeService(db);
      auth.api.signUpEmail.mockRejectedValue({
        statusCode: 422,
        status: 'EMAIL_IN_USE',
        body: { message: 'An account already exists' },
      });
      (
        service as unknown as { isAPIError: (e: unknown) => boolean }
      ).isAPIError = () => true;

      await expect(
        service.verifyOtp(EMAIL, '123456', 'password', makeResponse().response),
      ).rejects.toMatchObject({ response: { code: 'EMAIL_IN_USE' } });
      expect(auth.api.signUpEmail).toHaveBeenCalled();
    });
  });
});
