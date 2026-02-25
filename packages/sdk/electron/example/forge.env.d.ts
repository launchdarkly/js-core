/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

/** Injected at build time from LAUNCHDARKLY_MOBILE_KEY (see vite.renderer.config.ts). */
// eslint-disable-next-line no-underscore-dangle
declare const __LD_CLIENT_SIDE_ID__: string;

/** Injected at build time from LAUNCHDARKLY_FLAG_KEY (see vite.renderer.config.ts). */
// eslint-disable-next-line no-underscore-dangle
declare const __LD_FLAG_KEY__: string;
