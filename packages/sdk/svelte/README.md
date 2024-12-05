# Launch Darkly Svelte SDK

This is a Svelte library for Launch Darkly. It is a wrapper around the official Launch Darkly JavaScript SDK but with a Svelte-friendly API.

## Table of Contents

- [Getting Started](#getting-started)
- [Advanced Usage](#advanced-usage)
  - [Changing user context](#changing-user-context)
  - [Getting feature flag values](#getting-feature-flag-values)
    - [Getting immediate flag value](#getting-immediate-flag-value)
    - [Watching flag value changes](#watching-flag-value-changes)
    - [Getting all flag values](#getting-all-flag-values)

## Getting started

First, install the package:

```bash
npm install launchdarkly-svelte-client-sdk # or use yarn or pnpm
```

Then, initialize the SDK with your client-side ID using the `LDProvider` component:

```svelte
<script>
  import { LDProvider } from 'launchdarkly-svelte-client-sdk';
  import App from './App.svelte';
</script>

// Use context relevant to your application
const context = {
  user: {
    key: 'user-key',
    },
};

<LDProvider clientSideID="your-client-side-id" {context}>
  <App />
</LDProvider>
```

Now you can use the `LDFlag` component to conditionally render content based on feature flags:

```svelte
<script>
	import { LDFlag } from 'launchdarkly-svelte-client-sdk';
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
	import { LD } from 'launchdarkly-svelte-client-sdk';

    function handleLogin() {
        LD.identify({ key: 'new-user-key' });
    }
</script>

<button on:click={handleLogin}>Login</button>
```

### Getting feature flag values

#### Getting immediate flag value

If you need to get the value of a flag at time of evaluation you can use the `isOn` function:

```svelte
<script>
	import { LD } from 'launchdarkly-svelte-client-sdk';

	function handleClick() {
		const isFeatureFlagOn = LD.isOn('my-feature-flag');
		console.log(isFeatureFlagOn);
	}
</script>

<button on:click={handleClick}>Check flag value</button>
```

**Note:** Please note that `isOn` function will return the current value of the flag at the time of evaluation, which means you won't get notified if the flag value changes. This is useful for cases where you need to get the value of a flag at a specific time like a function call. If you need to get notified when the flag value changes, you should use the `LDFlag` component, the `watch` function or the `flags` object depending on you use case.

#### Watching flag value changes

If you need to get notified when a flag value changes you can use the `watch` function. The `watch` function is an instance of [Svelte Store](https://svelte.dev/docs/svelte-store), which means you can use it with the `$` store subscriber syntax or the `subscribe` method. Here is an example of how to use the `watch` function:

```svelte
<script>
	import { LD } from 'launchdarkly-svelte-client-sdk';

	$: flagValue = LD.watch('my-feature-flag');
</script>

<p>{$flagValue}</p>
```

#### Getting all flag values

If you need to get all flag values you can use the `flags` object. The `flags` object is an instance of [Svelte Store](https://svelte.dev/docs/svelte-store), which means you can use it with the `$` store subscriber syntax or the `subscribe` method. Here is an example of how to use the `flags` object:

```svelte
<script>
	import { LD } from 'launchdarkly-svelte-client-sdk';

	$: allFlags = LD.flags;
</script>

{#each Object.keys($allFlags) as flagName}
	<p>{flagName}: {$allFlags[flagName]}</p>
{/each}
```

## Credits

- Original code by [Robinson Marquez](https://github.com/nosnibor89)
