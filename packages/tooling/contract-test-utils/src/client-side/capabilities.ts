/**
 * Known capability strings from the SDK test harness service spec.
 * See: https://github.com/launchdarkly/sdk-test-harness/blob/v2/docs/service_spec.md
 *
 * Each entity should define its own capabilities array typed against this union,
 * since different SDKs advertise different capabilities.
 */
export type Capability =
  | 'server-side'
  | 'client-side'
  | 'mobile'
  | 'php'
  | 'singleton'
  | 'strongly-typed'
  | 'all-flags-with-reasons'
  | 'all-flags-client-side-only'
  | 'all-flags-details-only-for-tracked-flags'
  | 'anonymous-redaction'
  | 'auto-env-attributes'
  | 'big-segments'
  | 'client-independence'
  | 'client-prereq-events'
  | 'client-per-context-summaries'
  | 'context-type'
  | 'context-comparison'
  | 'etag-caching'
  | 'event-gzip'
  | 'optional-event-gzip'
  | 'event-sampling'
  | 'evaluation-hooks'
  | 'filtering'
  | 'filtering-strict'
  | 'http-proxy'
  | 'inline-context'
  | 'inline-context-all'
  | 'instance-id'
  | 'migrations'
  | 'omit-anonymous-contexts'
  | 'polling-gzip'
  | 'secure-mode-hash'
  | 'server-side-polling'
  | 'service-endpoints'
  | 'tags'
  | 'tls:verify-peer'
  | 'tls:skip-verify-peer'
  | 'tls:custom-ca'
  | 'track-hooks'
  | 'user-type'
  | 'wrapper';

/**
 * Capabilities shared by all client-side SDK contract test entities
 * (browser, react, electron). Platform-specific entities may extend
 * this list (e.g. react-native adds 'mobile').
 */
export const CLIENT_SIDE_CAPABILITIES: Capability[] = [
  'client-side',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-per-context-summaries',
  'track-hooks',
];
