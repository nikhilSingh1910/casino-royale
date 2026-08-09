import { Injectable } from '@nestjs/common';
import { AuditRepo, AuditRow } from './audit.repo';

export interface AuditEvent {
  actor: string;
  action: string;
  subject?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/**
 * The C4 back-office audit wrapper (D36) — the ONE writer to the append-only audit_log. Every trading
 * and account action records through here with before/after state, so the trail is attributable and
 * immutable (CLAUDE.md §4). Never updates or deletes; a correction is a new record.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditRepo) {}

  async record(e: AuditEvent): Promise<void> {
    await this.repo.insert(e.actor, e.action, e.subject ?? null, {
      before: e.before ?? null,
      after: e.after ?? null,
      reason: e.reason ?? null,
    });
  }

  recent(limit: number): Promise<AuditRow[]> {
    return this.repo.recent(limit);
  }

  forSubject(subject: string, limit: number): Promise<AuditRow[]> {
    return this.repo.forSubject(subject, limit);
  }
}
