module.exports = {
  "transform": { "^.+\\.ts?$": "ts-jest" },
  "testMatch": ["**/*.test.ts?(x)"],
  "testPathIgnorePatterns": ["node_modules", "dist"],
  "modulePathIgnorePatterns": ["dist"],
  "testEnvironment": "node",
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx", "json", "node"],
  "collectCoverageFrom": ["src/**/*.ts"]
};
