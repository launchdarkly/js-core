module.exports = {
  env: {
    node: true,
  },
  extends: ['airbnb-base', 'airbnb-typescript/base', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  ignorePatterns: ['**/dist/**', '**/vercel/examples/**'],
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
        devDependencies: ['**/jest*.ts', '**/*.test.ts', '**/rollup.config.ts'],
      },
    ],
    // 'import/no-unresolved': 'error',
    // 'import/default': 'error',
    // 'import/export': 'error',
    // 'import/no-self-import': 'error',
    // 'import/no-cycle': 'error',
    // 'import/no-useless-path-segments': 'error',
    // 'import/no-unused-modules': 'error',
    // 'import/no-duplicates': 'error',
  },
};
