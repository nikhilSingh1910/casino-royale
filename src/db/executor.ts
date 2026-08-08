import type { Kysely, Transaction } from 'kysely';
import type { Database } from './schema';

/** A DB handle usable standalone or inside a transaction — lets a repo share one caller's txn (D44). */
export type Executor = Kysely<Database> | Transaction<Database>;
