import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    return this.authService.register(body.email, body.password, response);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    return this.authService.login(body.email, body.password, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: boolean }> {
    return this.authService.logout(request, response);
  }

  @Public()
  @Get('me')
  me(@Req() request: Request) {
    return this.authService.getSession(request);
  }

  @Patch('profile')
  @HttpCode(200)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: UpdateProfileDto,
  ) {
    const userId = request.auth?.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }
    return this.authService.updateProfile(userId, request, response, body);
  }
}
