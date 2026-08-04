import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { IdentityRepo } from './identity.repo';
import { hashPassword, verifyPassword } from './password';

export class AuthError extends Error {}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

export interface Session {
  userId: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly repo: IdentityRepo) {}

  async signup(email: string, password: string): Promise<{ userId: string }> {
    if (await this.repo.findByEmail(email)) throw new AuthError('email already registered');
    const { id } = await this.repo.createUser(email, await hashPassword(password));
    return { userId: id };
  }

  async login(email: string, password: string): Promise<{ token: string; userId: string }> {
    const user = await this.repo.findByEmail(email);
    // verify against a real-or-dummy hash either way to avoid leaking which emails exist by timing.
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw new AuthError('invalid credentials');
    if (user.status !== 'active') throw new AuthError('account not active');

    const token = randomBytes(32).toString('hex');
    await this.repo.createSession(user.id, sha256(token), new Date(Date.now() + SESSION_TTL_MS));
    return { token, userId: user.id };
  }

  async validateSession(token: string): Promise<Session | null> {
    const s = await this.repo.findSessionByTokenHash(sha256(token));
    if (!s || s.revoked_at !== null || s.expires_at.getTime() < Date.now()) return null;
    return { userId: s.user_id, sessionId: s.id };
  }

  async logout(sessionId: string): Promise<void> {
    await this.repo.revokeSession(sessionId);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const hash = await this.repo.getPasswordHash(userId);
    if (!hash || !(await verifyPassword(currentPassword, hash))) {
      throw new AuthError('current password is incorrect');
    }
    await this.repo.updatePassword(userId, await hashPassword(newPassword));
    await this.repo.revokeOtherSessions(userId, sessionId); // keep the current session live
    await this.repo.audit(userId, 'password_changed', userId, null);
  }

  /** Admin action — suspend an account and terminate every session it holds (light D18). */
  async suspend(actorId: string, userId: string): Promise<void> {
    await this.repo.setStatus(userId, 'suspended');
    await this.repo.revokeAllSessions(userId);
    await this.repo.audit(actorId, 'account_suspended', userId, null);
  }
}

// A fixed scrypt hash of a random value, used only to keep login timing uniform for unknown emails.
const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' +
  '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000000000000000000000000';
