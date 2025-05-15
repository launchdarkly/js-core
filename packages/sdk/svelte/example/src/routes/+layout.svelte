<script lang="ts">
	import { LDProvider } from '@launchdarkly/svelte-client-sdk';
	import { PUBLIC_LD_CLIENT_ID } from '$env/static/public';

	const context = {
		kind: 'user',
		key: 'example-context-key',
		name: 'Sandy'
	};
</script>


{#snippet failed(error: unknown, reset: () => void)}
	<main>
		<h1>Something failed!</h1>
		<p>There was an error loading the app. Please make sure you have the environment variables properly setup</p>
		<button on:click={reset}>Retry</button>
	</main>
{/snippet}

<svelte:boundary {failed} onerror={console.error}>
	<LDProvider clientID={PUBLIC_LD_CLIENT_ID} {context}>
		<slot />

		<p slot="initializing">loading flags...</p>
	</LDProvider>
</svelte:boundary>
