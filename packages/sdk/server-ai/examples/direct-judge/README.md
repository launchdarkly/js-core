# LaunchDarkly AI SDK Direct Judge Example

This example demonstrates how to use the LaunchDarkly AI SDK's direct judge functionality to evaluate arbitrary input and output text. Unlike the chat judge example, which automatically evaluates responses from a chat invocation, the direct judge allows you to evaluate any input/output pair independently.

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

## AI Config Setup

1. Create a Judge AI Config in LaunchDarkly:
   - Navigate to the AI Configs section in your LaunchDarkly dashboard
   - Create a new AI Config in Judge mode with the key `ld-ai-judge-accuracy`
   - Configure the judge with evaluation criteria and scoring
   - Save and enable the configuration

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set the following environment variables:
   - `LAUNCHDARKLY_SDK_KEY`: Your LaunchDarkly SDK key (required)
   - `LAUNCHDARKLY_JUDGE_KEY`: Your judge AI Config key (defaults to 'ld-ai-judge-accuracy')
   - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI provider)

## Usage

To run the example (in the direct-judge directory):

```bash
yarn start
```

This will:
1. Initialize the LaunchDarkly SDK and AI client
2. Create a judge from a Judge AI Config
3. Evaluate a sample input/output pair using the judge
4. Display the judge evaluation results
