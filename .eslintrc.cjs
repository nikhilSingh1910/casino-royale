/**
 * Lint + money guardrails — CLAUDE.md §3.1, §3.11. Milestone M0 (C2.1, C6.1, C6.2).
 * Custom money rules live in eslint-local-rules.js (loaded via eslint-plugin-local-rules).
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: 'tsconfig.json', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'local-rules'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'eslint-local-rules.js'],
  rules: {
    // C2.1 — process.env is read in exactly one place (src/shared/config). Banned elsewhere.
    'no-restricted-properties': [
      'error',
      { object: 'process', property: 'env', message: 'Read env only in src/shared/config (C2.1).' },
    ],
    // C6.1 — no float in a money path (src/shared/money, src/ledger).
    'local-rules/no-float-in-money': 'error',
    // C6.2 — a list-returning export must accept a bounded limit. Heuristic; warn for now.
    'local-rules/bounded-list-return': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
  },
  overrides: [
    {
      // The one place env may be read.
      files: ['src/shared/config/**/*.ts'],
      rules: { 'no-restricted-properties': 'off' },
    },
    {
      // Deliberate rule violations that the guardrail meta-test asserts CI catches (C6.4).
      files: ['test/__fixtures__/**/*.ts'],
      rules: {
        'local-rules/no-float-in-money': 'off',
        'local-rules/bounded-list-return': 'off',
        'no-restricted-properties': 'off',
      },
    },
  ],
};
