module.exports = {
  env: {
    node: true,
    'jest/globals': true,
  },
  extends: ['airbnb-base', 'airbnb-typescript/base', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint', 'prettier', 'jest'],
  ignorePatterns: [
    '**/dist/**',
    '**/vercel/examples/**',
    '**/react-native/example/**',
    '**/react-universal/example/**',
    '**/fromExternal/**',
  ],
  rules: {
    '@typescript-eslint/lines-between-class-members': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^__' },
    ],
    'prettier/prettier': ['error'],
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
    'import/export': 'error',
    'import/extensions': ['error', 'never', { json: 'always' }],
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
