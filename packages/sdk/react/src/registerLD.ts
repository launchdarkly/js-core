// import { type LDClient } from '@launchdarkly/node-server-sdk';
//
// let serverSideLDClient: LDClient;
//
// // TODO: ld sdk
// export async function registerLD(sdkKey: string) {
//   if (process.env.NEXT_RUNTIME === 'nodejs') {
//     const { init } = await import('@launchdarkly/node-server-sdk');
//     serverSideLDClient = init(sdkKey);
//   }
// }
//
// export async function getLDClient() {
//   return process.env.NEXT_RUNTIME === 'nodejs' ? serverSideLDClient : undefined;
// }
