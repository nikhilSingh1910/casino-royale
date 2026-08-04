import { Rule, RuleTester } from 'eslint';

/**
 * M0 / C6.4 — prove the money guardrails actually catch violations.
 * We test the rules directly with ESLint's RuleTester (no TS project wiring needed).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rules = require('../eslint-local-rules') as Record<string, Rule.RuleModule>;
const noFloatInMoney = rules['no-float-in-money'] as Rule.RuleModule;
const boundedListReturn = rules['bounded-list-return'] as Rule.RuleModule;

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
} as unknown as ConstructorParameters<typeof RuleTester>[0]);

// C6.1 — no float in a money path.
ruleTester.run('no-float-in-money', noFloatInMoney, {
  valid: [
    { code: 'export const a = 5n + 3n;', filename: 'src/ledger/x.ts' },
    { code: 'export const a = 1.5;', filename: 'src/features/cricket/x.ts' }, // outside money path
  ],
  invalid: [
    {
      code: 'export const a = 1.5;',
      filename: 'src/ledger/x.ts',
      errors: [{ messageId: 'floatLiteral' }],
    },
    {
      code: 'export const f = (x: bigint, y: bigint): bigint => (x / y) as bigint;',
      filename: 'src/shared/money/x.ts',
      errors: [{ messageId: 'division' }],
    },
  ],
});

// C6.2 — a list-returning export must accept a bounded limit.
ruleTester.run('bounded-list-return', boundedListReturn, {
  valid: [
    { code: 'export function f(limit: number): number[] { return [limit]; }', filename: 'src/x.ts' },
    { code: 'export function g(): number { return 1; }', filename: 'src/x.ts' },
  ],
  invalid: [
    {
      code: 'export function h(): number[] { return []; }',
      filename: 'src/x.ts',
      errors: [{ messageId: 'unbounded' }],
    },
  ],
});
