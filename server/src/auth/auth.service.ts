import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import type { isAPIError } from 'better-auth/api';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { DatabaseSeedService } from '../database/database-seed.service';
import {
  account,
  accounts,
  budgets,
  categories,
  goals,
  recurring,
  rules,
  sessions,
  settings,
  subscriptions,
  tags,
  transactions,
  users,
} from '../database/schema';
import { timeZoneForCountry } from '../countries/countries';
import {
  createAuthInstance,
  loadAuthModules,
  type AuthInstance,
} from './auth.config';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  country: string | null;
  timeZone: string | null;
  onboardingComplete: boolean;
  createdAt: Date;
}

export interface SessionResult {
  session: { id: string; expiresAt: Date } | null;
  user: SessionUser | null;
}

interface AuthCallResult {
  headers?: Headers;
  response?: { user?: unknown; success?: boolean };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private auth!: AuthInstance;
  private isAPIError!: typeof isAPIError;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly seed: DatabaseSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { isAPIError } = await loadAuthModules();
    this.isAPIError = isAPIError;
    this.auth = await createAuthInstance(this.db, (userId) =>
      this.seed.seedUserDefaults(userId),
    );
  }

  async signInSocial(
    provider: 'google' | 'github',
    callbackURL: string,
    request: ExpressRequest,
    response: ExpressResponse,
  ): Promise<{ url: string }> {
    try {
      const result = await this.auth.api.signInSocial({
        body: { provider, callbackURL },
        headers: this.headersFrom(request),
        asResponse: true,
      });
      this.applyCookies(response, result.headers);
      const data = (await result.json()) as { url: string; redirect: boolean };
      return { url: data.url };
    } catch (error) {
      throw this.mapAuthError(error, 'Sign in failed.');
    }
  }

  async logout(
    request: ExpressRequest,
    response: ExpressResponse,
  ): Promise<{ success: boolean }> {
    try {
      const result = (await this.auth.api.signOut({
        headers: this.headersFrom(request),
        returnHeaders: true,
      })) as AuthCallResult;
      this.applyCookies(response, result.headers);
      return { success: true };
    } catch (error) {
      throw this.mapAuthError(error, 'Sign out failed.');
    }
  }

  async deleteAccount(
    userId: string,
    request: ExpressRequest,
    response: ExpressResponse,
  ): Promise<{ success: boolean }> {
    try {
      const result = (await this.auth.api.signOut({
        headers: this.headersFrom(request),
        returnHeaders: true,
      })) as AuthCallResult;
      this.applyCookies(response, result.headers);
    } catch (error) {
      this.logger.warn(
        `Sign-out during account deletion failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    await this.db.transaction(async (tx) => {
      await Promise.all([
        tx.delete(sessions).where(eq(sessions.userId, userId)),
        tx.delete(account).where(eq(account.userId, userId)),
        tx.delete(transactions).where(eq(transactions.userId, userId)),
        tx.delete(categories).where(eq(categories.userId, userId)),
        tx.delete(accounts).where(eq(accounts.userId, userId)),
        tx.delete(tags).where(eq(tags.userId, userId)),
        tx.delete(rules).where(eq(rules.userId, userId)),
        tx.delete(recurring).where(eq(recurring.userId, userId)),
        tx.delete(subscriptions).where(eq(subscriptions.userId, userId)),
        tx.delete(budgets).where(eq(budgets.userId, userId)),
        tx.delete(goals).where(eq(goals.userId, userId)),
        tx.delete(settings).where(eq(settings.userId, userId)),
      ]);
      await tx.delete(users).where(eq(users.id, userId));
    });
    return { success: true };
  }

  async getSession(
    request: ExpressRequest,
    response?: ExpressResponse,
  ): Promise<SessionResult | null> {
    try {
      const result = (await this.auth.api.getSession({
        headers: this.headersFrom(request),
        returnHeaders: true,
      })) as { headers: Headers; response: SessionResult | null };
      if (response && result.headers) {
        this.applyCookies(response, result.headers);
      }
      if (result.response === null || !result.response.user) {
        return { session: null, user: null };
      }
      const user = await this.fetchUser(result.response.user.id);
      return { session: result.response.session, user };
    } catch (error) {
      throw this.mapAuthError(error, 'Session check failed.');
    }
  }

  async updateProfile(
    userId: string,
    request: ExpressRequest,
    response: ExpressResponse,
    patch: {
      name?: string;
      image?: string | null;
      country?: string | null;
      onboardingComplete?: boolean;
    },
  ): Promise<SessionUser> {
    const body: Record<string, string | null> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.image !== undefined) body.image = patch.image;
    if (patch.country !== undefined) {
      body.country = patch.country;
      body.timeZone = timeZoneForCountry(patch.country);
    }

    try {
      const result = (await this.auth.api.updateUser({
        headers: this.headersFrom(request),
        body,
        returnHeaders: true,
      })) as AuthCallResult;
      if (result.headers) {
        this.applyCookies(response, result.headers);
      }
    } catch (error) {
      throw this.mapAuthError(error, 'Profile update failed.');
    }

    if (patch.onboardingComplete) {
      await this.db
        .update(users)
        .set({ onboardingComplete: true })
        .where(eq(users.id, userId));
    }

    return this.fetchUser(userId);
  }

  handler(request: Request): Promise<Response> {
    return this.auth.handler(request);
  }

  private async fetchUser(userId: string): Promise<SessionUser> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        country: users.country,
        timeZone: users.timeZone,
        onboardingComplete: users.onboardingComplete,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      throw new NotFoundException({
        message: 'User not found.',
        code: 'USER_NOT_FOUND',
      });
    }
    return user;
  }

  private headersFrom(request: ExpressRequest): Record<string, string> {
    return request.headers as Record<string, string>;
  }

  private applyCookies(response: ExpressResponse, headers?: Headers): void {
    if (!headers) {
      return;
    }
    const cookies = headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      response.setHeader('Set-Cookie', cookies);
    }
  }

  private mapAuthError(error: unknown, fallback: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (this.isAPIError(error)) {
      const status = error.statusCode ?? 400;
      const message = error.body?.message ?? error.message ?? fallback;
      return new HttpException(
        { message, code: error.status ?? 'AUTH_FAILED' },
        status,
      );
    }
    this.logger.warn(
      `Auth failure: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new InternalServerErrorException(fallback);
  }
}
