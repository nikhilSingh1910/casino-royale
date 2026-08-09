import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database, KYSELY } from '../../db';

export interface AuditRow {
  actor: string;
  action: string;
  subject: string | null;
  detail: unknown;
  at: Date;
}

@Injectable()
export class AuditRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async insert(actor: string, action: string, subject: string | null, detail: unknown): Promise<void> {
    await this.db
      .insertInto('audit_log')
      .values({ actor, action, subject, detail: detail === undefined ? null : JSON.stringify(detail) })
      .execute();
  }

  /** The recent audit trail across all subjects, newest first, bounded (CLAUDE.md §3.3). */
  async recent(limit: number): Promise<AuditRow[]> {
    const rows = await this.db
      .selectFrom('audit_log')
      .select(['actor', 'action', 'subject', 'detail', 'created_at as at'])
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({ actor: r.actor, action: r.action, subject: r.subject, detail: r.detail, at: r.at }));
  }

  /** Audit trail for one subject (e.g. a market), newest first, bounded (CLAUDE.md §3.3). */
  async forSubject(subject: string, limit: number): Promise<AuditRow[]> {
    const rows = await this.db
      .selectFrom('audit_log')
      .select(['actor', 'action', 'subject', 'detail', 'created_at as at'])
      .where('subject', '=', subject)
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({ actor: r.actor, action: r.action, subject: r.subject, detail: r.detail, at: r.at }));
  }
}
