import { flagConcentration } from './integrity';

describe('integrity: concentration (pure, D36)', () => {
  it('flags a user holding more than 60% of the market stake', () => {
    const flags = flagConcentration([
      { userId: 'a', stake: 800n },
      { userId: 'b', stake: 200n },
    ], 100);
    expect(flags).toEqual([{ code: 'user-concentration', userId: 'a', shareBps: 8000 }]);
  });

  it('does not flag a balanced book', () => {
    expect(flagConcentration([{ userId: 'a', stake: 500n }, { userId: 'b', stake: 500n }], 100)).toEqual([]);
  });

  it('treats the threshold as exclusive (>, not ≥) — exactly 60% is not flagged', () => {
    expect(flagConcentration([{ userId: 'a', stake: 600n }, { userId: 'b', stake: 400n }], 100)).toEqual([]);
  });

  it('handles an empty market', () => {
    expect(flagConcentration([], 100)).toEqual([]);
  });
});
