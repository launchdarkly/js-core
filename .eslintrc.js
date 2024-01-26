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
  ignorePatterns: ['**/dist/**', '**/vercel/examples/**', '**/react-native/example/**', '**/fromExternal/**'],
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
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    // 'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
  },
  globals: {
    BigInt: 'readonly',
  },
};
