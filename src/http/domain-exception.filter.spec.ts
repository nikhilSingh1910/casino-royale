import { ArgumentsHost } from '@nestjs/common';
import { BetRejectedError } from '../features/cricket';
import { LedgerError } from '../ledger';
import { DomainExceptionFilter } from './domain-exception.filter';

describe('DomainExceptionFilter', () => {
  const run = (e: unknown): { status: number; body: Record<string, unknown> } => {
    let captured = { status: 0, body: {} as Record<string, unknown> };
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: (s: number) => ({
            send: (b: unknown) => {
              captured = { status: s, body: b as Record<string, unknown> };
            },
          }),
        }),
      }),
    } as unknown as ArgumentsHost;
    new DomainExceptionFilter().catch(e, host);
    return captured;
  };

  it('maps a ledger insufficient-funds race to 409, not a leaked 500 (C3)', () => {
    const r = run(new LedgerError('Insufficient funds: user:abc:chips would go to -50'));
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('insufficient_funds');
    expect(JSON.stringify(r.body)).not.toContain('user:'); // internal account names never reach the client
  });

  it('maps a rejected bet to 400', () => {
    expect(run(new BetRejectedError('market not open')).status).toBe(400);
  });

  it('an unmapped error is a 500 carrying no internals', () => {
    const r = run(new Error('kaboom'));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: 'internal' });
  });
});
