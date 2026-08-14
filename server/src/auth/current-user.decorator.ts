import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }
    return userId;
  },
);
