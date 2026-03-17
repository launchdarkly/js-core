module.exports = {
  overrides: [
    {
      files: ['contract-tests/**/*.ts'],
      parserOptions: {
        project: './contract-tests/tsconfig.json',
      },
    },
  ],
};
