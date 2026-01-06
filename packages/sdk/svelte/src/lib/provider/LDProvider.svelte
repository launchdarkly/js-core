<script lang="ts">
	import { onMount } from 'svelte';
	import { LD } from '../client/SvelteLDClient.js';
	import type { LDClientID, LDContext } from '../client/SvelteLDClient.js';

	export let clientID: LDClientID;
	export let context: LDContext;
	const { initialize, initalizationState } = LD;

	onMount(() => {
		initialize(clientID, context);
	});
</script>

{#if $$slots.initializing && $initalizationState === 'pending'}
	<slot name="initializing">Loading flags (default loading slot value)...</slot>
{:else if $initalizationState === 'complete'}
	<slot />
{:else}
	<slot name="failed">Failed to initialize LaunchDarkly client ({$initalizationState})</slot>
{/if}
