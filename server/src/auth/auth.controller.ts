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
import {
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './auth.dto';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  register(
    @Body() body: RegisterDto,
  ): Promise<{ pending: true; email: string }> {
    return this.authService.register(body.email);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(201)
  verify(
    @Body() body: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    return this.authService.verifyOtp(
      body.email,
      body.otp,
      body.password,
      response,
    );
  }

  @Public()
  @Post('register/resend')
  @HttpCode(202)
  resend(
    @Body() body: ResendOtpDto,
  ): Promise<{ pending: true; email: string }> {
    return this.authService.resendOtp(body.email);
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
