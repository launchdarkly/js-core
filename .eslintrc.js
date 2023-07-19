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
    'prettier/prettier': ['error'],
    'class-methods-use-this': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        // solves '@testing-library/jest-dom' should be listed in the project's dependencies, not devDependencies
        devDependencies: ['**/jest*.ts'],
      },
    ],
  },
};
