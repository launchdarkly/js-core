/**
 * The connection mode for the SDK to use.
 *
 * @remarks
 * The following connection modes are supported:
 *
 * offline - When the SDK is set offline it will stop receiving updates and will stop sending
 * analytic and diagnostic events.
 *
 * streaming - The SDK will use a streaming connection to receive updates from LaunchDarkly.
 *
 * polling - The SDK will make polling requests to receive updates from LaunchDarkly.
 *
 * automatic - The SDK will handle the connection automatically and may make polling or streaming
 * requests.
 */
type ConnectionMode = 'offline' | 'streaming' | 'polling' | 'automatic';

export default ConnectionMode;
