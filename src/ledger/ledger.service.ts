import { Injectable } from '@nestjs/common';

/**
 * The only authority on chips (CLAUDE.md §4). Implemented in M1 as a Postgres double-entry
 * table (D33). Nothing outside src/ledger/ may reach past this barrel — enforced by
 * dependency-cruiser (rule: ledger-barrel-only).
 */
@Injectable()
export class LedgerService {}
