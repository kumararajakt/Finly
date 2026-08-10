import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { users } from '../database/schema';
import { timeZoneForCountry } from '../countries/countries';
import {
  createAuthInstance,
  OWNER_NAME,
  type AuthInstance,
} from './auth.config';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  country: string | null;
  timeZone: string | null;
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
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly auth: AuthInstance;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    this.auth = createAuthInstance(db);
  }

  async register(
    email: string,
    password: string,
    response: Response,
  ): Promise<{ user: unknown }> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    if (count > 0) {
      throw new ConflictException({
        message: 'An account already exists. Sign in instead.',
        code: 'ALREADY_REGISTERED',
      });
    }

    try {
      const result = (await this.auth.api.signUpEmail({
        body: { email: email.trim().toLowerCase(), password, name: OWNER_NAME },
        returnHeaders: true,
      })) as AuthCallResult;
      this.applyCookies(response, result.headers);
      return { user: result.response?.user };
    } catch (error) {
      throw this.mapAuthError(error, 'Registration failed.');
    }
  }

  async login(
    email: string,
    password: string,
    response: Response,
  ): Promise<{ user: unknown }> {
    try {
      const result = (await this.auth.api.signInEmail({
        body: { email: email.trim().toLowerCase(), password },
        returnHeaders: true,
      })) as AuthCallResult;
      this.applyCookies(response, result.headers);
      return { user: result.response?.user };
    } catch (error) {
      this.logger.warn(
        `Login failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException({
        message: 'Incorrect password.',
        code: 'INVALID_CREDENTIALS',
      });
    }
  }

  async logout(
    request: Request,
    response: Response,
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

  async getSession(
    request: Request,
    response?: Response,
  ): Promise<SessionResult | null> {
    try {
      const result = (await this.auth.api.getSession({
        headers: this.headersFrom(request),
        returnHeaders: true,
      })) as { headers: Headers; response: SessionResult | null };
      if (response && result.headers) {
        this.applyCookies(response, result.headers);
      }
      return result.response === null
        ? { session: null, user: null }
        : result.response;
    } catch (error) {
      throw this.mapAuthError(error, 'Session check failed.');
    }
  }

  async updateProfile(
    userId: string,
    request: Request,
    response: Response,
    patch: { name?: string; image?: string | null; country?: string | null },
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

    return this.fetchUser(userId);
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

  private headersFrom(request: Request): Record<string, string> {
    return request.headers as Record<string, string>;
  }

  private applyCookies(response: Response, headers?: Headers): void {
    if (!headers) {
      return;
    }
    const cookies = headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      response.setHeader('Set-Cookie', cookies);
    }
  }

  private mapAuthError(error: unknown, fallback: string): HttpException {
    if (isAPIError(error)) {
      const status = error.statusCode ?? HttpStatus.BAD_REQUEST;
      const message = error.body?.message ?? error.message ?? fallback;
      if (status === 422) {
        return new ConflictException({
          message,
          code: 'ALREADY_REGISTERED',
        });
      }
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
