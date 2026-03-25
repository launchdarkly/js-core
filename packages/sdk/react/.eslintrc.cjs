module.exports = {
  ignorePatterns: ['contract-tests/next-env.d.ts', 'examples/server-only/next-env.d.ts'],
  overrides: [
    {
      files: ['contract-tests/**/*.ts', 'contract-tests/**/*.tsx'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './contract-tests/tsconfig.json',
      },
    },
  ],
};
