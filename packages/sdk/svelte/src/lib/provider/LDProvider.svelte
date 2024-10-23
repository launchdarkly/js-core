<script lang="ts">
	import { onMount } from 'svelte';
	import { LD } from '../client/SvelteLDClient.js';
	import type { LDClientID, LDContext } from '../client/SvelteLDClient.js';

	export let clientID: LDClientID;
	export let context: LDContext;
	const { initialize, initializing } = LD;

	onMount(() => {
		initialize(clientID, context);
	});
</script>

{#if $$slots.initializing && $initializing}
	<slot name="initializing">Loading flags (default loading slot value)...</slot>
{:else}
	<slot />
{/if}
