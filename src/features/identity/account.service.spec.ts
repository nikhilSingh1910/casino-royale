import { bonusKey, nextDailyReset } from './account.service';

describe('daily bonus keying (pure, PC2)', () => {
  it('is one key per user per UTC day', () => {
    const late = new Date('2026-08-09T23:59:00Z');
    const early = new Date('2026-08-09T00:01:00Z');
    expect(bonusKey('u1', late)).toBe(bonusKey('u1', early)); // same UTC day → same key
    expect(bonusKey('u1', late)).not.toBe(bonusKey('u2', late)); // per user
    expect(bonusKey('u1', late)).not.toBe(bonusKey('u1', new Date('2026-08-10T00:01:00Z'))); // next day
  });

  it('the next reset is the following UTC midnight', () => {
    expect(nextDailyReset(new Date('2026-08-09T15:00:00Z')).toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });
});
