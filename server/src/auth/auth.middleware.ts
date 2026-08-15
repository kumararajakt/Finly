import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class OAuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response): Promise<void> {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const webRequest = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
    });
    const webResponse = await this.authService.handler(webRequest);
    res.status(webResponse.status);
    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        return;
      }
      res.setHeader(key, value);
    });
    const setCookies = webResponse.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies);
    }
    res.send(await webResponse.text());
  }
}
