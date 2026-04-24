const stylistic = require('@stylistic/eslint-plugin');

const stylisticConfig = stylistic.configs.customize({
  semi: true,
  arrowParens: true,
  braceStyle: '1tbs',
  quoteProps: 'as-needed',
});

module.exports = {
  env: {
    node: true,
    'jest/globals': true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      './packages/sdk/svelte/tsconfig.eslint.json',
      './tsconfig.eslint.json',
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', '@stylistic', 'simple-import-sort', 'import', 'jest'],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/vercel/examples/**',
    '**/react-native/example/**',
    '**/electron/example/**',
    '**/svelte/.svelte-kit/**',
    '**/server-ai/examples/chat-judge/**',
    '**/server-ai/examples/direct-judge/**',
    '**/fromExternal/**',
    '**/next-env.d.ts',
  ],
  rules: {
    'no-param-reassign': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    'no-var': 'error',
    'valid-typeof': 'error',
    'no-restricted-syntax': [
      'error',
      { selector: 'ForInStatement', message: 'Use Object.{keys,values,entries} instead.' },
      { selector: 'LabeledStatement', message: 'Labels are a form of GOTO.' },
      { selector: 'WithStatement', message: '`with` is disallowed in strict mode.' },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^__' },
    ],

    ...stylisticConfig.rules,
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
    '@stylistic/operator-linebreak': ['error', 'after'],
    '@stylistic/jsx-one-expression-per-line': 'off',
    'simple-import-sort/imports': ['error', {
      groups: [
        ['^\\u0000'],
        ['^node:', '^(?!@launchdarkly)(?!\\.)'],
        ['^@launchdarkly'],
        ['^\\.'],
      ],
    }],
    'simple-import-sort/exports': 'error',
    'class-methods-use-this': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/jest*.ts',
          '**/*.test.ts',
          '**/rollup.config.ts',
          '**/*{.,_}{test,spec}.{ts,tsx}',
        ],
      },
    ],
    'import/default': 'error',
    'import/export': 'off',
    'import/extensions': 'off',
    'import/no-self-import': 'error',
    'import/no-cycle': 'error',
    'import/no-useless-path-segments': 'error',
    'import/no-duplicates': 'error',
    'import/prefer-default-export': 'off',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/valid-expect': 'error',
    'no-underscore-dangle': ['error', { allowAfterThis: true }],
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
  },
  globals: {
    BigInt: 'readonly',
  },
};
