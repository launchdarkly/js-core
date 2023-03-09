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
  ignorePatterns: ['**/dist/**'],
  rules: {
    'prettier/prettier': ['error'],
  },
};
