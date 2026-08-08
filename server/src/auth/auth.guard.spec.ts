import {
  Controller,
  ExecutionContext,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('dummy')
class DummyController {
  @Public()
  @Get('public')
  publicRoute(this: void): string {
    return 'ok';
  }

  @Get('protected')
  protectedRoute(this: void): string {
    return 'ok';
  }
}

function mockContext(
  handler: unknown,
  controllerClass: unknown,
  request: unknown,
  response: unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { getSession: jest.Mock };

  const handler = DummyController.prototype.publicRoute;
  const protectedHandler = DummyController.prototype.protectedRoute;

  beforeEach(async () => {
    authService = { getSession: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        Reflector,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();
    guard = moduleRef.get(AuthGuard);
  });

  it('allows public routes without a session', async () => {
    const request = { headers: {} };
    await expect(
      guard.canActivate(mockContext(handler, DummyController, request, {})),
    ).resolves.toBe(true);
    expect(authService.getSession).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated protected routes', async () => {
    authService.getSession.mockResolvedValue({ session: null, user: null });
    const request = { headers: {} };
    await expect(
      guard.canActivate(
        mockContext(protectedHandler, DummyController, request, {}),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows authenticated protected routes and attaches the session', async () => {
    const sessionResult = { session: { id: 's1' }, user: { id: 'u1' } };
    authService.getSession.mockResolvedValue(sessionResult);
    const request: { headers: Record<string, string>; auth?: unknown } = {
      headers: {},
    };
    const result = await guard.canActivate(
      mockContext(protectedHandler, DummyController, request, {}),
    );
    expect(result).toBe(true);
    expect(request.auth).toEqual(sessionResult);
  });
});
