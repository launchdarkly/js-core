// Polyfill timer functions for Shopify Oxygen runtime
// NOTE: we only provide these polyfills if they are not already available
// since the Oxygen runtime provide these functions in the request handler context,
// but not in the global context.

if (typeof globalThis.setInterval === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.setInterval = () =>
    // Return a no-op handle that can be passed to clearInterval
    ({}) as any;
}

if (typeof globalThis.clearInterval === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.clearInterval = () => {
    // No-op
  };
}

if (typeof globalThis.setTimeout === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.setTimeout = () =>
    // Return a no-op handle that can be passed to clearTimeout
    ({}) as any;
}

if (typeof globalThis.clearTimeout === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.clearTimeout = () => {
    // No-op
  };
}
