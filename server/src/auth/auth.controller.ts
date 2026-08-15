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
import { SocialSignInDto, UpdateProfileDto } from './auth.dto';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('social')
  @HttpCode(200)
  socialSignIn(
    @Body() body: SocialSignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ url: string }> {
    return this.authService.signInSocial(
      body.provider,
      body.callbackURL,
      request,
      response,
    );
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
