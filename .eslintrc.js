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
    'prettier/prettier': ['error'],
    'class-methods-use-this': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/jest*.ts', '**/*.test.ts'],
      },
    ],
  },
};
