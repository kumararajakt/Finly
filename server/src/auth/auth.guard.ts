import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthService, type SessionResult } from './auth.service';

export interface AuthenticatedRequest extends Request {
  auth: SessionResult;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const session = await this.authService.getSession(request, response);
    if (!session?.session) {
      throw new UnauthorizedException({
        message: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    (request as AuthenticatedRequest).auth = session;
    return true;
  }
}
