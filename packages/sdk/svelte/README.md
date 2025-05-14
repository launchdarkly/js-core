# LaunchDarkly Svelte Client SDK

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

This is the Svelte Client SDK for LaunchDarkly. It is a wrapper around the LaunchDarkly JavaScript SDK but with a Svelte-friendly API.

## Getting started

First, install the package:

```bash
# npm
npm install @launchdarkly/svelte-client-sdk

# yarn
yarn add @launchdarkly/svelte-client-sdk
```

Then, initialize the SDK with your client-side ID using the `LDProvider` component:

```svelte
<script>
  import { LDProvider } from '@launchdarkly/svelte-client-sdk';
  import App from './App.svelte';
</script>

// Use context relevant to your application
const context = {
    kind: 'user',
    key: 'user-key',
};

<LDProvider clientID="your-client-side-id" {context}>
  <App />
</LDProvider>
```

Now you can use the `LDFlag` component to conditionally render content based on feature flags:

```svelte
<script>
    import { LDFlag } from '@launchdarkly/svelte-client-sdk';
</script>

<LDFlag flag={'my-feature-flag'}>
    <div slot="on">
        <p>this will render if the feature flag is on</p>
    </div>
    <div slot="off">
        <p>this will render if the feature flag is off</p>
    </div>
</LDFlag>
```

## Advanced usage

### Changing user context

You can change the user context by using the `identify` function from the `LD` object:

```svelte
<script>
    import { LD } from '@launchdarkly/svelte-client-sdk';

    function handleLogin() {
        LD.identify({ key: 'new-user-key' });
    }
</script>

<button on:click={handleLogin}>Login</button>
```

### Getting feature flag values

#### Getting immediate flag value

If you need to get the value of a flag at time of evaluation you can use the `useFlag` function:

```svelte
<script>
    import { LD } from '@launchdarkly/svelte-client-sdk';

    function handleClick() {
        const isFeatureFlagOn = LD.useFlag('my-feature-flag', false);
        console.log(isFeatureFlagOn);
    }
</script>

<button on:click={handleClick}>Check flag value</button>
```

**Note:** Please note that `useFlag` function will return the current value of the flag at the time of evaluation, which means you won't get notified if the flag value changes. This is useful for cases where you need to get the value of a flag at a specific time like a function call. If you need to get notified when the flag value changes, you should use the `LDFlag` component, the `watch` function or the `flags` object depending on your use case.

#### Watching flag value changes

If you need to get notified when a flag value changes you can use the `watch` function. The `watch` function is an instance of [Svelte Store](https://svelte.dev/docs/svelte-store), which means you can use it with the `$` store subscriber syntax or the `subscribe` method. Here is an example of how to use the `watch` function:

```svelte
<script>
    import { LD } from '@launchdarkly/svelte-client-sdk';

    $: flagValue = LD.watch('my-feature-flag');
</script>

<p>{$flagValue}</p>
```

#### Getting all flag values

If you need to get all flag values you can use the `flags` object. The `flags` object is an instance of [Svelte Store](https://svelte.dev/docs/svelte-store), which means you can use it with the `$` store subscriber syntax or the `subscribe` method. Here is an example of how to use the `flags` object:

```svelte
<script>
    import { LD } from '@launchdarkly/svelte-client-sdk';

    $: allFlags = LD.flags;
</script>

{#each Object.keys($allFlags) as flagName}
    <p>{flagName}: {$allFlags[flagName]}</p>
{/each}
```

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

## Credits

- Original Svelte SDK code contributed by [Robinson Marquez](https://github.com/nosnibor89)
