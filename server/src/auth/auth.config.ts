import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import type { Database } from '../database/database.module';

export const OWNER_EMAIL = process.env.FINLY_OWNER_EMAIL ?? 'owner@finly.local';
export const OWNER_NAME = 'Owner';

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_REFRESH_WINDOW_SECONDS = 60 * 60 * 24;

export function createAuthInstance(db: Database) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: process.env.SESSION_SECRET ?? 'somesecret',
    baseURL:
      process.env.BETTER_AUTH_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`,
    user: {
      modelName: 'users',
    },
    session: {
      modelName: 'sessions',
      expiresIn: SESSION_DURATION_SECONDS,
      updateAge: SESSION_REFRESH_WINDOW_SECONDS,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    advanced: {
      cookiePrefix: 'finly',
      defaultCookieAttributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuthInstance>;
