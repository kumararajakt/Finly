import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import type { isAPIError } from 'better-auth/api';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { DatabaseSeedService } from '../database/database-seed.service';
import { emailOtps, users } from '../database/schema';
import { timeZoneForCountry } from '../countries/countries';
import { MailService } from '../mail/mail.service';
import {
  createAuthInstance,
  loadAuthModules,
  type AuthInstance,
} from './auth.config';
import {
  generateOtp,
  hashOtp,
  normalizeEmail,
  otpMatches,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from './otp';

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

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local.length > 0 ? local : email;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private auth!: AuthInstance;
  private isAPIError!: typeof isAPIError;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mail: MailService,
    private readonly seed: DatabaseSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { isAPIError } = await loadAuthModules();
    this.isAPIError = isAPIError;
    this.auth = await createAuthInstance(this.db);
  }

  async register(email: string): Promise<{ pending: true; email: string }> {
    const normalized = normalizeEmail(email);
    const otp = await this.issueOtp(normalized);
    await this.mail.sendOtp(normalized, otp);
    return { pending: true, email: normalized };
  }

  async verifyOtp(
    email: string,
    otp: string,
    password: string,
    response: Response,
  ): Promise<{ user: unknown }> {
    const normalized = normalizeEmail(email);
    const [row] = await this.db
      .select()
      .from(emailOtps)
      .where(eq(emailOtps.email, normalized))
      .orderBy(desc(emailOtps.createdAt))
      .limit(1);

    if (!row || row.expiresAt.getTime() < Date.now()) {
      if (row) {
        await this.deleteOtp(row.id);
      }
      throw new HttpException(
        {
          message: 'This code has expired. Request a new one.',
          code: 'OTP_EXPIRED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deleteOtp(row.id);
      throw new HttpException(
        {
          message: 'Too many attempts. Request a new code.',
          code: 'OTP_TOO_MANY_ATTEMPTS',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!otpMatches(normalized, otp, row.otpHash)) {
      const attempts = row.attempts + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.deleteOtp(row.id);
      } else {
        await this.db
          .update(emailOtps)
          .set({ attempts })
          .where(eq(emailOtps.id, row.id));
      }
      throw new HttpException(
        {
          message: 'Incorrect code. Try again.',
          code: 'INVALID_OTP',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const name = displayNameFromEmail(normalized);

    try {
      const result = (await this.auth.api.signUpEmail({
        body: { email: normalized, password, name },
        returnHeaders: true,
      })) as AuthCallResult;
      this.applyCookies(response, result.headers);
      await this.db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.email, normalized));
      await this.deleteOtp(row.id);

      const userId = (result.response?.user as { id?: string } | undefined)?.id;
      if (userId) {
        await this.seed.seedUserDefaults(userId);
      }

      return { user: result.response?.user };
    } catch (error) {
      throw this.mapAuthError(error, 'Registration failed.');
    }
  }

  async resendOtp(email: string): Promise<{ pending: true; email: string }> {
    const normalized = normalizeEmail(email);
    const [latest] = await this.db
      .select()
      .from(emailOtps)
      .where(eq(emailOtps.email, normalized))
      .orderBy(desc(emailOtps.createdAt))
      .limit(1);

    if (
      latest &&
      latest.createdAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        {
          message: 'Please wait before requesting a new code.',
          code: 'OTP_COOLDOWN',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = await this.issueOtp(normalized);
    await this.mail.sendOtp(normalized, otp);
    return { pending: true, email: normalized };
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

  private async issueOtp(email: string): Promise<string> {
    await this.db.delete(emailOtps).where(eq(emailOtps.email, email));
    const otp = generateOtp();
    await this.db.insert(emailOtps).values({
      email,
      otpHash: hashOtp(email, otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    return otp;
  }

  private async deleteOtp(id: string): Promise<void> {
    await this.db.delete(emailOtps).where(eq(emailOtps.id, id));
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
    if (this.isAPIError(error)) {
      const status = error.statusCode ?? HttpStatus.BAD_REQUEST;
      const message = error.body?.message ?? error.message ?? fallback;
      if (status === 422) {
        return new ConflictException({
          message,
          code: 'EMAIL_IN_USE',
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
