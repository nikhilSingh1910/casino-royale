/**
 * Custom money guardrails — CLAUDE.md §3.1, §3.3. Loaded by eslint-plugin-local-rules.
 * Kept deliberately simple and robust (adversarial-review note in the M0 loop): heuristic
 * checks in a bounded set of directories, not full dataflow analysis.
 */
'use strict';

const MONEY_DIRS = /(^|\/)src\/(shared\/money|ledger)\//;

module.exports = {
  // C6.1 — no float in a money path. Chips are integers; floats and division are how they leak.
  'no-float-in-money': {
    meta: {
      type: 'problem',
      docs: { description: 'No floating-point literals or division in money/ledger code (CLAUDE.md §3.1).' },
      schema: [],
      messages: {
        floatLiteral: 'Floating-point literal in a money path. Chips are integers (CLAUDE.md §3.1).',
        division: 'Division in a money path leaks floats. Use integer arithmetic with explicit rounding (CLAUDE.md §3.1).',
      },
    },
    create(context) {
      const filename = context.getFilename().replace(/\\/g, '/');
      if (!MONEY_DIRS.test(filename)) return {};
      return {
        Literal(node) {
          if (typeof node.value === 'number' && typeof node.raw === 'string' && node.raw.includes('.')) {
            context.report({ node, messageId: 'floatLiteral' });
          }
        },
        BinaryExpression(node) {
          if (node.operator === '/') context.report({ node, messageId: 'division' });
        },
        AssignmentExpression(node) {
          if (node.operator === '/=') context.report({ node, messageId: 'division' });
        },
      };
    },
  },

  // C6.2 — a list-returning export must accept a bounded limit. Heuristic: exported function whose
  // return type is an array and whose params include no limit-like name.
  'bounded-list-return': {
    meta: {
      type: 'suggestion',
      docs: { description: 'List-returning exported functions take a bounded limit (CLAUDE.md §3.3).' },
      schema: [],
      messages: {
        unbounded: 'Exported list-returning function has no limit parameter (CLAUDE.md §3.3 — no unbounded returns).',
      },
    },
    create(context) {
      const LIMIT = /^(limit|take|first|top|pageSize|count)$/i;
      function returnsArray(fn) {
        const rt = fn.returnType && fn.returnType.typeAnnotation;
        if (!rt) return false;
        if (rt.type === 'TSArrayType') return true;
        if (rt.type === 'TSTypeReference' && rt.typeName && /^(Array|ReadonlyArray)$/.test(rt.typeName.name)) return true;
        // Promise<T[]>
        if (rt.type === 'TSTypeReference' && rt.typeName && rt.typeName.name === 'Promise') {
          const inner = rt.typeParameters && rt.typeParameters.params && rt.typeParameters.params[0];
          return !!inner && (inner.type === 'TSArrayType' ||
            (inner.type === 'TSTypeReference' && inner.typeName && /^(Array|ReadonlyArray)$/.test(inner.typeName.name)));
        }
        return false;
      }
      function hasLimit(fn) {
        return (fn.params || []).some((p) => {
          const id = p.type === 'Identifier' ? p : p.type === 'TSParameterProperty' ? p.parameter : null;
          return id && id.name && LIMIT.test(id.name);
        });
      }
      function check(node) {
        if (returnsArray(node) && !hasLimit(node)) context.report({ node, messageId: 'unbounded' });
      }
      return {
        'ExportNamedDeclaration > FunctionDeclaration': check,
        'MethodDefinition[accessibility!="private"] > FunctionExpression': check,
      };
    },
  },
};
