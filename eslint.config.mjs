// Next 16 dropped `next lint`; ESLint flat config used directly. Starting minimal
// — Next's config shapes across 15/16 have been in flux. When things stabilize
// (or when we pin Next exactly), reintroduce the next/core-web-vitals + next/typescript
// presets. For now, TypeScript ESLint's recommended rules catch the real stuff.
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/**',
      'etl/**',
      'playwright-report/**',
      'test-results/**',
      '.vercel/**',
      'next-env.d.ts',
      '*.config.js',
      '*.config.mjs',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
