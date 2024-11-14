# LaunchDarkly AI SDK for OpenAI Example

This package demonstrates the integration of LaunchDarkly's AI SDK with OpenAI, allowing you to leverage LaunchDarkly's AI Config capabilities in AI-powered applications using OpenAI's services.

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

- `LAUNCHDARKLY_SDK_KEY`: Your LaunchDarkly SDK key
- `LAUNCHDARKLY_AI_CONFIG_KEY`: Your LaunchDarkly AI configuration key (defaults to 'sample-ai-config' if not set)
- `OPENAI_API_KEY`: Your OpenAI API key

## Usage

The main script (`index.js`) demonstrates how to:

1. Initialize the LaunchDarkly SDK
2. Set up a user context
3. Initialize the LaunchDarkly AI client
4. Retrieve an AI model configuration
5. Send a prompt to OpenAI
6. Track token usage

To run the example (in the openai directory):

```bash
yarn start
```

## Note

This example uses OpenAI's chat completions API. Make sure your LaunchDarkly AI configuration is set up correctly to work with OpenAI's models and API structure.
