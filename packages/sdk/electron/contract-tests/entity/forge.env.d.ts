/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

/** Injected at build time from LD_CLIENT_SIDE_ID (see vite.renderer.config.ts). */
// eslint-disable-next-line no-underscore-dangle
declare const __LD_CLIENT_SIDE_ID__: string;
