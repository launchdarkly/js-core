// Polyfill timer functions for Shopify Oxygen runtime
// These functions are polyfilled to do nothing since the Oxygen runtime
// may not provide these timer functions

// Polyfill setInterval - returns a no-op handle
if (typeof globalThis.setInterval === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.setInterval = () =>
    // Return a no-op handle that can be passed to clearInterval
    ({}) as any;
}

// Polyfill clearInterval - does nothing
if (typeof globalThis.clearInterval === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.clearInterval = () => {
    // No-op
  };
}

// Polyfill setTimeout - returns a no-op handle
if (typeof globalThis.setTimeout === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.setTimeout = () =>
    // Return a no-op handle that can be passed to clearTimeout
    ({}) as any;
}

// Polyfill clearTimeout - does nothing
if (typeof globalThis.clearTimeout === 'undefined') {
  // @ts-ignore - Polyfill implementation doesn't need full Node.js typing
  globalThis.clearTimeout = () => {
    // No-op
  };
}
