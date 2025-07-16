import {
  createBedrockTokenUsage,
  createOpenAiUsage,
  createVercelAISDKTokenUsage,
} from '../src/api/metrics';

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

it('createOpenAiUsage should create token usage with all values provided', () => {
  const usage = createOpenAiUsage({
    total_tokens: 100,
    prompt_tokens: 40,
    completion_tokens: 60,
  });

  expect(usage).toEqual({
    total: 100,
    input: 40,
    output: 60,
  });
});

it('createOpenAiUsage should default to 0 for missing values', () => {
  const usage = createOpenAiUsage({});

  expect(usage).toEqual({
    total: 0,
    input: 0,
    output: 0,
  });
});

it('createOpenAiUsage should handle explicitly undefined values', () => {
  const usage = createOpenAiUsage({
    total_tokens: undefined,
    prompt_tokens: 40,
    completion_tokens: undefined,
  });

  expect(usage).toEqual({
    total: 0,
    input: 40,
    output: 0,
  });
});

it('createVercelAISDKTokenUsage should create token usage with all values provided', () => {
  const usage = createVercelAISDKTokenUsage({
    totalTokens: 100,
    promptTokens: 40,
    completionTokens: 60,
  });

  expect(usage).toEqual({
    total: 100,
    input: 40,
    output: 60,
  });
});

it('createVercelAISDKTokenUsage should default to 0 for missing values', () => {
  const usage = createVercelAISDKTokenUsage({});

  expect(usage).toEqual({
    total: 0,
    input: 0,
    output: 0,
  });
});

it('createVercelAISDKTokenUsage should handle explicitly undefined values', () => {
  const usage = createVercelAISDKTokenUsage({
    totalTokens: undefined,
    promptTokens: 40,
    completionTokens: undefined,
  });

  expect(usage).toEqual({
    total: 0,
    input: 40,
    output: 0,
  });
});
