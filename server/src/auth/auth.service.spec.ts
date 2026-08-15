import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';

const EMAIL = 'owner@finly.local';

const userChain = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve(rows)),
  })),
});

function makeDb() {
  const db = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  db.update.mockImplementation(() => ({
    set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  }));
  return db;
}

function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    name: 'owner',
    email: EMAIL,
    image: null,
    country: null,
    timeZone: null,
    onboardingComplete: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  const seed = {
    seedUserDefaults: jest.fn<Promise<void>, [userId: string]>(),
  };
  const auth = {
    api: {
      signInSocial: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      updateUser: jest.fn<
        Promise<{ headers: { getSetCookie: () => string[] } | undefined }>,
        [args: Record<string, unknown>]
      >(),
    },
    handler: jest.fn(),
  };
  const service = new AuthService(db as never, seed as never);
  (service as unknown as { auth: typeof auth }).auth = auth;
  (service as unknown as { isAPIError: (e: unknown) => boolean }).isAPIError =
    () => false;
  return { service, seed, auth };
}

function makeResponse() {
  const setHeader = jest.fn();
  return {
    setHeader,
    response: { setHeader } as unknown as Response,
  };
}

describe('AuthService', () => {
  describe('signInSocial', () => {
    it('returns the authorization URL and forwards the state cookie', async () => {
      const db = makeDb();
      const { service, auth } = makeService(db);
      const headers = new Headers();
      headers.append(
        'set-cookie',
        'finly.state=abc.def; Max-Age=300; Path=/; HttpOnly; SameSite=Lax',
      );
      auth.api.signInSocial.mockResolvedValue(
        new Response(
          JSON.stringify({
            url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=…',
            redirect: true,
          }),
          { headers },
        ),
      );
      const { setHeader, response } = makeResponse();

      const result = await service.signInSocial(
        'google',
        'http://localhost:5173',
        { headers: {} } as never,
        response,
      );

      expect(result).toEqual({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=…',
      });
      expect(auth.api.signInSocial).toHaveBeenCalledWith({
        body: { provider: 'google', callbackURL: 'http://localhost:5173' },
        headers: {},
        asResponse: true,
      });
      expect(setHeader).toHaveBeenCalledWith('Set-Cookie', [
        'finly.state=abc.def; Max-Age=300; Path=/; HttpOnly; SameSite=Lax',
      ]);
    });

    it('maps provider errors to an HTTP exception', async () => {
      const db = makeDb();
      const { service, auth } = makeService(db);
      auth.api.signInSocial.mockRejectedValue({
        statusCode: HttpStatus.NOT_FOUND,
        status: 'PROVIDER_NOT_FOUND',
        body: { message: 'Provider not found' },
      });
      (
        service as unknown as { isAPIError: (e: unknown) => boolean }
      ).isAPIError = () => true;
      const { response } = makeResponse();

      await expect(
        service.signInSocial(
          'google',
          'http://localhost:5173',
          {} as never,
          response,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PROVIDER_NOT_FOUND' },
      });
    });
  });

  describe('getSession', () => {
    it('returns a normalized user when a session exists', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(userChain([userRow()]));
      const { service, auth } = makeService(db);
      auth.api.getSession.mockResolvedValue({
        headers: { getSetCookie: () => [] },
        response: {
          session: { id: 's1', expiresAt: new Date() },
          user: { id: 'u1' },
        },
      });

      const result = await service.getSession({ headers: {} } as never);

      expect(result).toMatchObject({
        session: { id: 's1' },
        user: { id: 'u1', email: EMAIL, onboardingComplete: false },
      });
    });

    it('returns a null session when unauthenticated', async () => {
      const db = makeDb();
      const { service, auth } = makeService(db);
      auth.api.getSession.mockResolvedValue({
        headers: { getSetCookie: () => [] },
        response: null,
      });

      await expect(
        service.getSession({ headers: {} } as never),
      ).resolves.toEqual({ session: null, user: null });
    });

    it('rejects when the user row is missing', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(userChain([]));
      const { service, auth } = makeService(db);
      auth.api.getSession.mockResolvedValue({
        headers: { getSetCookie: () => [] },
        response: {
          session: { id: 's1', expiresAt: new Date() },
          user: { id: 'u1' },
        },
      });

      await expect(
        service.getSession({ headers: {} } as never),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'USER_NOT_FOUND' },
      });
    });
  });

  describe('logout', () => {
    it('calls signOut and applies the session cookies', async () => {
      const db = makeDb();
      const { service, auth } = makeService(db);
      auth.api.signOut.mockResolvedValue({
        headers: { getSetCookie: () => ['finly.session_token='] },
        response: { success: true },
      });
      const { setHeader, response } = makeResponse();

      const result = await service.logout({ headers: {} } as never, response);

      expect(result).toEqual({ success: true });
      expect(setHeader).toHaveBeenCalledWith('Set-Cookie', [
        'finly.session_token=',
      ]);
    });
  });

  describe('updateProfile', () => {
    it('marks onboarding complete in the users table', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        userChain([userRow({ onboardingComplete: true })]),
      );
      const { service, auth } = makeService(db);
      auth.api.updateUser.mockResolvedValue({ headers: undefined });

      const result = await service.updateProfile(
        'u1',
        { headers: {} } as never,
        makeResponse().response,
        { onboardingComplete: true },
      );

      expect(result).toMatchObject({ id: 'u1', onboardingComplete: true });
      expect(auth.api.updateUser).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('derives the timezone from the selected country', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(
        userChain([userRow({ country: 'JP', timeZone: 'Asia/Tokyo' })]),
      );
      const { service, auth } = makeService(db);
      auth.api.updateUser.mockResolvedValue({ headers: undefined });

      await service.updateProfile(
        'u1',
        { headers: {} } as never,
        makeResponse().response,
        { country: 'JP' },
      );

      const call = auth.api.updateUser.mock.calls[0]?.[0] as {
        body: Record<string, string | null>;
      };
      expect(call.body).toMatchObject({
        country: 'JP',
        timeZone: 'Asia/Tokyo',
      });
    });

    it('keeps onboarding incomplete when the flag is not set', async () => {
      const db = makeDb();
      db.select.mockReturnValueOnce(userChain([userRow()]));
      const { service, auth } = makeService(db);
      auth.api.updateUser.mockResolvedValue({ headers: undefined });

      await service.updateProfile(
        'u1',
        { headers: {} } as never,
        makeResponse().response,
        { name: 'New Name' },
      );

      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
