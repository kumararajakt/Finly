import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bootstrap } from '../src/bootstrap';

type FinlyApp = Awaited<ReturnType<typeof bootstrap>>;

let appPromise: Promise<FinlyApp> | null = null;

function getApp(): Promise<FinlyApp> {
  if (!appPromise) {
    appPromise = bootstrap({
      migrate: process.env.AUTO_MIGRATE === 'true',
    });
  }
  return appPromise;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const app = await getApp();
  const instance = app.getHttpAdapter().getInstance() as (
    request: VercelRequest,
    response: VercelResponse,
  ) => void;
  instance(req, res);
}
