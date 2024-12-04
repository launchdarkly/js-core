<script lang="ts">
	import { LDProvider } from '@launchdarkly/svelte-client-sdk';
	import { PUBLIC_LD_CLIENT_ID } from '$env/static/public';

	const context = {
		kind: 'user',
		key: 'example-context-key',
		name: 'Sandy'
	};
</script>

<div>
	<LDProvider clientID={PUBLIC_LD_CLIENT_ID} {context}>
		<slot />

		<p slot="initializing">loading flags...</p>
	</LDProvider>
</div>
