/**
 * Layer & boundary enforcement — CLAUDE.md §3.3, §7. Milestone M0 (C1.2, C1.3, C6.3).
 * Run: pnpm lint:boundaries
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are a design smell and break clean layering.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'ledger-barrel-only',
      severity: 'error',
      comment:
        'C1.3 — nothing outside src/ledger/ may reach into ledger internals. ' +
        'The chip ledger is the only authority on chips; import it only via src/ledger/index.ts.',
      from: { pathNot: '^src/ledger/' },
      to: { path: '^src/ledger/', pathNot: '^src/ledger/index\\.ts$' },
    },
    {
      name: 'shared-is-leaf',
      severity: 'error',
      comment: 'CLAUDE.md §3.3 — shared/ is a leaf; it imports nothing from feature/app/ledger layers.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app|ledger|integrations|jobs)/' },
    },
    {
      name: 'controllers-call-services-only',
      severity: 'error',
      comment: 'CLAUDE.md §3.3 — controllers call services; never a repo or the db directly.',
      from: { path: '\\.controller\\.ts$' },
      to: { path: '(\\.repo\\.ts$|^src/db/)' },
    },
    {
      name: 'only-repo-and-ledger-touch-db',
      severity: 'error',
      comment: 'CLAUDE.md §3.3 — the repo layer and the ledger are the only db touchers.',
      from: { pathNot: '(\\.repo\\.ts$|^src/db/|^src/ledger/)' },
      to: { path: '^src/db/', pathNot: '^src/db/index\\.ts$' },
    },
    {
      name: 'cross-feature-via-barrel',
      severity: 'error',
      comment: 'CLAUDE.md §3.3 — cross-feature access only through the published index.ts.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'CLAUDE.md §3.8 — dead modules. Delete on sight (index/barrel files exempt).',
      from: { orphan: true, pathNot: '(\\.d\\.ts$|(^|/)index\\.ts$|\\.module\\.ts$|(^|/)main\\.ts$)' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
};
