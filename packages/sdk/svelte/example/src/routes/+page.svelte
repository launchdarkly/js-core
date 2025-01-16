<script lang="ts">
	import { LDFlag } from '@launchdarkly/svelte-client-sdk';
	import { PUBLIC_LD_FLAG_KEY } from '$env/static/public';
</script>

<style>
	div {
		margin: 1rem;
		padding: 1rem;
		width: 250px;
		height: 250px;
		border: 1px solid #ccc;
		background-color: var(--bg-color);
	}
</style>

<LDFlag flag={PUBLIC_LD_FLAG_KEY}>
	<div slot="true" style="--bg-color: lightblue;">
		<p>this box is lightblue when flag is on ({PUBLIC_LD_FLAG_KEY})</p>
	</div>
	<div slot="false" style="--bg-color: lightyellow;">
		<p>this box is lightyellow when flag is off ({PUBLIC_LD_FLAG_KEY})</p>
	</div>
</LDFlag>


