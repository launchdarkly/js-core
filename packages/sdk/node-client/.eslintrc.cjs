module.exports = {
  overrides: [
    {
      files: ['contract-tests/**/*.ts'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './contract-tests/tsconfig.json',
      },
    },
  ],
};
