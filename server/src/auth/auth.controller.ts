import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginDto, RegisterDto } from './auth.dto';
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
    return this.authService.register(body.password, response);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    return this.authService.login(body.password, response);
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
}
