import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database, KYSELY } from '../../db';

export type AccountStatus = 'active' | 'suspended' | 'closed';

@Injectable()
export class IdentityRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async createUser(email: string, passwordHash: string): Promise<{ id: string }> {
    return this.db
      .insertInto('app_user')
      .values({ email, password_hash: passwordHash })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  async findByEmail(email: string) {
    return this.db
      .selectFrom('app_user')
      .select(['id', 'email', 'password_hash', 'status'])
      .where('email', '=', email)
      .executeTakeFirst();
  }

  async findById(id: string) {
    return this.db
      .selectFrom('app_user')
      .select(['id', 'email', 'status', 'role'])
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async getPasswordHash(id: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom('app_user')
      .select('password_hash')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.password_hash;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .updateTable('app_user')
      .set({ password_hash: passwordHash, password_changed_at: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  async setStatus(userId: string, status: AccountStatus): Promise<void> {
    await this.db.updateTable('app_user').set({ status }).where('id', '=', userId).execute();
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<{ id: string }> {
    return this.db
      .insertInto('user_session')
      .values({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.db
      .selectFrom('user_session')
      .select(['id', 'user_id', 'expires_at', 'revoked_at'])
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
  }

  async revokeSession(id: string): Promise<void> {
    await this.db
      .updateTable('user_session')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .updateTable('user_session')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async revokeOtherSessions(userId: string, exceptId: string): Promise<void> {
    await this.db
      .updateTable('user_session')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('id', '<>', exceptId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  /** Append-only audit (C4). Reusable AuditService is extracted when CM5 (console) lands. */
  async audit(actor: string, action: string, subject: string | null, detail: unknown): Promise<void> {
    await this.db
      .insertInto('audit_log')
      .values({ actor, action, subject, detail: detail === undefined ? null : JSON.stringify(detail) })
      .execute();
  }
}
