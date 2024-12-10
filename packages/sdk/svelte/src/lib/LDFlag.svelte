<script lang="ts">
    import { LD, type LDFlagValue } from './client/SvelteLDClient.js';

    export let flag: string;
    export let matches: LDFlagValue = true;

    $: flagValue = LD.watch(flag);
  </script>

  {#if $flagValue === matches}
    <slot name="true" />
  {:else}
    <slot name="false" />
  {/if}
