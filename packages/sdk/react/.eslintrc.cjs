module.exports = {
  ignorePatterns: ['contract-tests/next-env.d.ts'],
  overrides: [
    {
      files: ['contract-tests/**/*.ts', 'contract-tests/**/*.tsx'],
      parserOptions: {
        project: './contract-tests/tsconfig.json',
      },
    },
  ],
};
