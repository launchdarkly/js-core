import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import jest from 'eslint-plugin-jest';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Global ignores (replaces .eslintignore + ignorePatterns)
  {
    ignores: [
      '**/.yarn/**',
      '**/dist/**',
      '**/.next/**',
      '**/.vite/**',
      // NOTE: we are ignoring these examples because they were being ignored
      // before, we will need to isolate specific rules for examples and
      // remove these in the future.
      '**/vercel/examples/**',
      '**/react-native/example/**',
      '**/react-native/example-fdv2/**',
      '**/react/contract-tests/**',
      '**/react/examples/**',
      '**/jest/example/**',
      '**/electron/example/**',
      '**/svelte/.svelte-kit/**',
      '**/svelte/example/**',
      '**/fastly/example/build/**',
      '**/server-ai/examples/chat-judge/**',
      '**/server-ai/examples/direct-judge/**',
      '**/fromExternal/**',
    ],
  },

  // Base config for all TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      importPlugin.flatConfigs.recommended,
      tseslint.configs.recommended
    ],
    plugins: {
      // Alias as 'import' so existing eslint-disable comments with import/ prefix keep working
      import: importPlugin,
      jest,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        BigInt: 'readonly',
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: 'tsconfig.eslint.json',
        }),
      ],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^__',
          caughtErrors: 'none',
        },
      ],
      // naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['method'],
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: ['method'],
          format: ['camelCase'],
          modifiers: ['private'],
          leadingUnderscore: 'require',
        },
        {
          selector: ['classProperty', 'parameterProperty'],
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: ['classProperty', 'parameterProperty'],
          modifiers: ['static'],
          format: ['PascalCase'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: ['classProperty', 'parameterProperty'],
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
      ],
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ForInStatement', message: 'Use Object.{keys,values,entries} instead.' },
        { selector: 'LabeledStatement', message: 'Labels are a form of GOTO.' },
        { selector: 'WithStatement', message: '`with` is disallowed in strict mode.' },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            // NOTE: we should uncomment this in the future as config files typically
            // only read from devdependencies
            '**/jest*.ts',
            // '**/*.config.ts',
            '**/*.d.ts',
            '**/*{.,_}test.{ts,tsx}',
            // '**/*{.,_}spec.{ts,tsx}',
          ],
        },
      ],
      // enable url-scheme imports
      'import-x/no-unresolved': ['error', { ignore: ['^[a-z]+:'] }],
      'no-underscore-dangle': ['error', { allowAfterThis: true }],
      'no-await-in-loop': 'error',
      'no-new': 'error',
      'no-console': 'error',
      // Catches whitespace-only lines left behind when auto-fix removes
      // eslint-disable directives. Auto-fixable, so a second --fix pass cleans up.
      'no-trailing-spaces': 'error',
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],

      // NOTE: this will allow object fields to be reassigned.
      'no-param-reassign': [ 'error' ],

      // TODO: we may want to re-enable this in the future.
      '@typescript-eslint/ban-ts-comment': 'off',

      // extension rules (https://typescript-eslint.io/rules#extension-rules)
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": "error",
      'eqeqeq': ['error', 'always', { 'null': 'ignore' }],

      // Keeping this as a reference, but I don't think we really need to enforce this rule.
      // "class-methods-use-this": "off",
      // "@typescript-eslint/class-methods-use-this": "error"
    },
  },

  // Test files: add jest globals and jest rules; relax test-specific rules
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx'
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/valid-expect': 'error',
      // 'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import-x/no-unresolved': 'off',
    },
  },

  // Examples, contract-tests, and tooling packages: allow console
  {
    files: [
      '**/example/**',
      '**/examples/**',
      '**/example-*/**',
      '**/contract-tests/**',
      'packages/tooling/**',
    ],
    rules: {
      'no-console': 'off',
      // TODO: a lot of our examples fail this one, will need to check
      'import-x/no-unresolved': 'off',
    },
  },

  // Svelte SDK: the package's tsconfig extends .svelte-kit/tsconfig.json which
  // is gitignored and only generated by `svelte-kit sync`. The import-x
  // resolver crashes if it tries to walk that chain.
  {
    files: ['packages/sdk/svelte/**/*.ts', 'packages/sdk/svelte/**/*.tsx'],
    rules: {
      'import-x/no-unresolved': 'off',
    },
  },

  // Override: contract-test-utils needs 'always' extensions (with ts exception)
  {
    files: ['packages/tooling/contract-test-utils/**/*.ts'],
    rules: {
      'import/extensions': ['error', 'always', { ts: 'never' }],
    },
  },
);
