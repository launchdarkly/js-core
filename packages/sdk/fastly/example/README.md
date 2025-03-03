# Example test app for Fastly LaunchDarkly SDK

This is an example test app to showcase the usage of the Fastly LaunchDarkly SDK in a [Fastly Compute](https://docs.fastly.com/products/compute-at-edge) application. The example demonstrates:

1. Initializing the LaunchDarkly SDK with a Fastly KV Store
2. Evaluating boolean and string feature flags
3. Using multi-kind contexts to include Fastly-specific data
4. Serving different images based on feature flag variations

Most of the LaunchDarkly-related code can be found in [src/index.ts](src/index.ts).

#### Photo credits

Cat photo by [Sergey Semin](https://unsplash.com/@feneek?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash) on [Unsplash](https://unsplash.com/photos/brown-and-white-tabby-cat-DwHULfmhulE?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash). Dog photo by [Taylor Kopel](https://unsplash.com/@taylorkopel?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash) on [Unsplash](https://unsplash.com/photos/yellow-labrador-retriever-puppy-sitting-on-floor-WX4i1Jq_o0Y?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash).

## Prerequisites

A node environment of version 16 and yarn are required to develop in this repository.
You will also need the [Fastly CLI](https://developer.fastly.com/learning/tools/cli) installed and a Fastly account to setup
the test data required by this example. If you don't have a Fastly account, you can sign up for a free developer account [here](https://www.fastly.com/signup?tier=free).

## Setting up your LaunchDarkly environment

For simplicity, we recommend [creating a new LaunchDarkly project](https://docs.launchdarkly.com/home/organize/projects/?q=create+proj) for this example app. After creating a new project, create the following feature flags:

- `example-flag` - (Boolean) - This flag is evaluated in the root endpoint
- `animal` - (String) - This flag determines which animal image to show (values: "cat" or "dog")

## Setting up your development environment

1. At the root of the js-core repo:

```shell
yarn && yarn build
```

2. Replace `LAUNCHDARKLY_CLIENT_ID` in [src/index.ts](src/index.ts) with your LaunchDarkly SDK key.

3. Create a new Fastly Compute service in the Fastly UI.

4. Create a new Fastly KV in the Fastly UI named `launchdarkly`.

5. Run the following command to install dependencies:

```shell
yarn
```

5. Start the local development server:

```shell
yarn start
```

6. Test the endpoints:

- Visit `http://127.0.0.1:7676/` for the boolean flag evaluation
- Visit `http://127.0.0.1:7676/animal` to see an image controlled by the string flag
- Visit `http://127.0.0.1:7676/cat` or `http://127.0.0.1:7676/dog` for direct image access

7. Deploy to Fastly:

```shell
yarn deploy
```
