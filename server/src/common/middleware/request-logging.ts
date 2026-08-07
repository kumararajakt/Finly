import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function requestLogging(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
}
