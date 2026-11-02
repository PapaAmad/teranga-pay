import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/android/**',
      '**/ios/**',
      '.tmp/**',
      '.husky/_/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: { 'no-console': ['error', { allow: ['info', 'warn', 'error'] }] },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/jest.setup.{js,ts}', '**/jest.setup.{cjs,mjs}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
