# LaunchDarkly AI SDK Judge Evaluation Example

This package demonstrates the integration of LaunchDarkly's AI SDK Judge functionality for evaluating AI responses using AI Configs with `mode: "judge"`.

## Installation and Build

When running as part of the js-core mono-repo the project will use local dependencies.
As such those dependencies need built.

In the root of the repository run:

```bash
yarn
```

And then

```bash
yarn build
```

## Configuration

Before running the example, make sure to set the following environment variables:

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and set the following environment variables:
   - `LAUNCHDARKLY_SDK_KEY`: Your LaunchDarkly SDK key (required)
   - `LAUNCHDARKLY_AI_CONFIG_KEY`: Your AI Config key (defaults to 'sample-ai-config')
   - `LAUNCHDARKLY_JUDGE_KEY`: Your judge AI Config key (defaults to 'ld-ai-judge-accuracy')
   - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI provider)

## Usage

The main script (`index.js`) demonstrates how to:

1. Initialize the LaunchDarkly SDK
1. Set up a user context
1. Initialize the LaunchDarkly AI client
1. Create a judge for evaluation
1. Evaluate AI responses using the `evaluate()` method
1. Handle evaluation results and errors

To run the example (in the judge-evaluation directory):

```bash
yarn start
```

## AI Config Setup

Make sure you have an AI Config configured in LaunchDarkly with `mode: "judge"`:

**relevance-judge**: AI Config for relevance evaluation

The judge config should include:
- `messages`: Array of messages with evaluation prompts
- `model`: Model configuration (e.g., GPT-4)
- `provider`: Provider configuration (e.g., OpenAI)
- `evaluationMetricKeys`: Array of strings representing the metric keys to report scores to LaunchDarkly.

## Note

This example uses the Judge functionality to evaluate AI responses. Make sure your LaunchDarkly AI Configs are set up correctly with `mode: "judge"` and include the necessary evaluation prompts and metrics.
