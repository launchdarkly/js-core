// When FDv2 becomes the default data system, this type should replace
// the existing ConnectionMode type in api/ConnectionMode.ts.

/**
 * Connection modes for the FDv2 data system.
 *
 * This type is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 *
 * This defines the full set of named connection modes available in FDv2.
 * Each mode maps to a specific initializer/synchronizer pipeline via the
 * mode table.
 *
 * @remarks
 * The following connection modes are supported:
 *
 * streaming - Initializes from cache then polling. Synchronizes via streaming
 * with polling fallback. Designed for mobile foreground and desktop use.
 *
 * polling - Initializes from cache. Synchronizes via polling at the configured
 * interval.
 *
 * offline - Initializes from cache only. No synchronizers run. The SDK will not
 * receive updates or send analytic/diagnostic events.
 *
 * one-shot - Initializes from cache, then polling, then streaming. No
 * synchronizers run after initialization. Designed for browser SDKs where
 * a single flag fetch at page load is sufficient.
 *
 * background - Initializes from cache. Synchronizes via polling at a reduced
 * frequency (1 hour by default). Designed for mobile SDKs when the application
 * is in the background.
 */
type FDv2ConnectionMode = 'streaming' | 'polling' | 'offline' | 'one-shot' | 'background';

export default FDv2ConnectionMode;
