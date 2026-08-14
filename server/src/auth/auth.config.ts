import type { Database } from '../database/database.module';

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_REFRESH_WINDOW_SECONDS = 60 * 60 * 24;

type BetterAuthModule = typeof import('better-auth');
type DrizzleAdapterModule = typeof import('@better-auth/drizzle-adapter');
type BetterAuthApiModule = typeof import('better-auth/api');

export interface AuthModules {
  betterAuth: BetterAuthModule['betterAuth'];
  drizzleAdapter: DrizzleAdapterModule['drizzleAdapter'];
  isAPIError: BetterAuthApiModule['isAPIError'];
}

let modulesPromise: Promise<AuthModules> | null = null;

export function loadAuthModules(): Promise<AuthModules> {
  modulesPromise ??= Promise.all([
    import('better-auth'),
    import('@better-auth/drizzle-adapter'),
    import('better-auth/api'),
  ]).then(([betterAuthModule, adapterModule, apiModule]) => ({
    betterAuth: betterAuthModule.betterAuth,
    drizzleAdapter: adapterModule.drizzleAdapter,
    isAPIError: apiModule.isAPIError,
  }));
  return modulesPromise;
}

export async function createAuthInstance(db: Database) {
  const { betterAuth, drizzleAdapter } = await loadAuthModules();
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: process.env.SESSION_SECRET ?? 'somesecret',
    baseURL:
      process.env.BETTER_AUTH_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`,
    user: {
      modelName: 'users',
      additionalFields: {
        country: {
          type: 'string',
          required: false,
          defaultValue: null,
        },
        timeZone: {
          type: 'string',
          required: false,
          defaultValue: null,
        },
      },
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
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    },
  });
}

export type AuthInstance = Awaited<ReturnType<typeof createAuthInstance>>;
