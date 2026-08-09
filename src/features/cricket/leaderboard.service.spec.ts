import { handle } from './leaderboard.service';

describe('leaderboard handle (pure, PC5)', () => {
  it('derives a stable, non-PII handle from the user id — never the email', () => {
    const h = handle('abcdef12-3456-7890-abcd-ef1234567890');
    expect(h).toBe('Player ABCDEF');
    expect(h).not.toContain('@'); // no email / PII
  });

  it('is stable and distinct per user', () => {
    expect(handle('user-one-aaaa')).toBe(handle('user-one-aaaa'));
    expect(handle('user-one-aaaa')).not.toBe(handle('user-two-bbbb'));
  });
});
