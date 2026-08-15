import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Database } from '../../src/database/database.module';
import { sessions, users } from '../../src/database/schema';

export interface AuthenticatedAgent {
  agent: ReturnType<typeof request.agent>;
  userId: string;
  email: string;
}

/**
 * Creates a user + session directly in the DB and returns a supertest agent
 * that carries a valid Better Auth session cookie (signed with the same
 * SESSION_SECRET the app uses), so authenticated endpoints can be exercised
 * without a real OAuth provider round trip.
 */
export async function createAuthenticatedAgent(
  app: INestApplication<App>,
  db: Database,
  email = `user-${randomUUID()}@finly.local`,
): Promise<AuthenticatedAgent> {
  const userId = `user-${randomUUID()}`;
  const token = `session-token-${randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    name: 'Test User',
    email,
    emailVerified: true,
    onboardingComplete: true,
  });
  await db.insert(sessions).values({
    id: `session-${randomUUID()}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const agent = request.agent(app.getHttpServer());
  agent.set('Cookie', [sessionCookie(token)]);
  return { agent, userId, email };
}

export function sessionCookie(token: string): string {
  const secret = process.env.SESSION_SECRET ?? 'somesecret';
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return `finly.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}
