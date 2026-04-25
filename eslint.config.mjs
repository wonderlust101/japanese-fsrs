// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // ── Ignore generated / non-source directories ────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'supabase/**',
      'index.ts',           // root bun scaffold file
    ],
  },

  // ── TypeScript-aware base rules ──────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── Project-wide overrides (CONVENTIONS.md) ──────────────────────────────
  {
    rules: {
      // §1.1 — @ts-ignore is banned; @ts-expect-error must include a description.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],

      // §1.1 — Use unknown instead of any.
      '@typescript-eslint/no-explicit-any': 'error',

      // §1.5 — Never use ! non-null assertion on values from the DB or API.
      '@typescript-eslint/no-non-null-assertion': 'error',

      // §1.7 — Annotate return types of exported functions and async functions.
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Unused vars: allow underscore-prefixed names (intentionally unused).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Prefer type imports for type-only imports (verbatimModuleSyntax companion).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
)
