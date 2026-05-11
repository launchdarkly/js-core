import { createBedrockTokenUsage } from '../src/api/metrics';

it('createBedrockTokenUsage should create token usage with all values provided', () => {
  const usage = createBedrockTokenUsage({
    totalTokens: 100,
    inputTokens: 40,
    outputTokens: 60,
  });

  expect(usage).toEqual({
    total: 100,
    input: 40,
    output: 60,
  });
});

it('createBedrockTokenUsage should default to 0 for missing values', () => {
  const usage = createBedrockTokenUsage({});

  expect(usage).toEqual({
    total: 0,
    input: 0,
    output: 0,
  });
});

it('createBedrockTokenUsage should handle explicitly undefined values', () => {
  const usage = createBedrockTokenUsage({
    totalTokens: undefined,
    inputTokens: 40,
    outputTokens: undefined,
  });

  expect(usage).toEqual({
    total: 0,
    input: 40,
    output: 0,
  });
});
