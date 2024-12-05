# LaunchDarkly Svelte SDK Example

This project demonstrates the usage of the `@launchdarkly/svelte-client-sdk`. It showcases how to conditionally render content based on feature flags using the `LDFlag` component.

## Installing Dependencies and Setting Environment Variables

First, install the project dependencies:

```bash
yarn install
```

Next, create a `.env` file in the root of the project and add your LaunchDarkly client-side ID and flag key. You can obtain these from any LaunchDarkly project/environment you choose.

```bash
PUBLIC_LD_CLIENT_SIDE_ID=your-client-side-id
PUBLIC_LD_FLAG_KEY=your-flag-key
```

Note: The flag specified by `PUBLIC_LD_FLAG_KEY` must be a boolean flag.

## Running the Project

To run the project, use the following command:

```bash
yarn dev
```

This will start the development server. Open your browser and navigate to the provided URL to see the example in action. The box will change its background color based on the value of the feature flag specified by `PUBLIC_LD_FLAG_KEY`.

### Role of `LDProvider`

The `LDProvider` component is used to initialize the LaunchDarkly client and provide the feature flag context to the rest of the application. It requires a `clientID` and a `context` object. The `context` object typically contains information about the user or environment, which LaunchDarkly uses to determine the state of feature flags.

In this example, the `LDProvider` wraps the entire application, ensuring that all child components have access to the feature flag data. The `slot="initializing"` is used to display a loading message while the flags are being fetched.
