/* eslint-disable no-console, @typescript-eslint/no-use-before-define, no-restricted-globals */
/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { includeBytes } from 'fastly:experimental';
import { KVStore } from 'fastly:kv-store';

import { init } from '@launchdarkly/fastly-server-sdk';
import type { LDMultiKindContext } from '@launchdarkly/js-server-sdk-common';

// Set your LaunchDarkly client ID here
const LAUNCHDARKLY_CLIENT_ID = '<your-client-id>';
// Set the KV store name used to store the LaunchDarkly data here
const KV_STORE_NAME = 'launchdarkly';
// Set the Fastly Backend name used to send LaunchDarkly events here
const EVENTS_BACKEND_NAME = 'launchdarkly';

const cat = includeBytes('./src/cat.jpeg');
const dog = includeBytes('./src/dog.jpeg');

// The entry point for your application.
//
// Use this fetch event listener to define your main request handling logic. It
// could be used to route based on the request properties (such as method or
// path), send the request to a backend, make completely new requests, and/or
// generate synthetic responses.

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent) {
  // Log service version
  console.log('FASTLY_SERVICE_VERSION:', env('FASTLY_SERVICE_VERSION') || 'local');

  // Get the client request.
  const req = event.request;

  // Filter requests that have unexpected methods.
  if (!['HEAD', 'GET', 'PURGE'].includes(req.method)) {
    return new Response('This method is not allowed', {
      status: 405,
    });
  }

  const isLocal = env('FASTLY_HOSTNAME') === 'localhost';
  const kvStoreName = isLocal ? 'launchdarkly_local' : KV_STORE_NAME;
  const ldClientId = isLocal ? 'local' : LAUNCHDARKLY_CLIENT_ID;

  const store = new KVStore(kvStoreName);
  const ldClient = init(ldClientId, store, {
    sendEvents: true,
    eventsBackendName: EVENTS_BACKEND_NAME,
  });
  await ldClient.waitForInitialization();

  const flagContext: LDMultiKindContext = {
    kind: 'multi',
    user: {
      // In a real-world scenario, you would use get the user key from a cookie, header, or other source
      key: 'test-user',
    },
    'fastly-request': {
      key: env('FASTLY_TRACE_ID'),
      fastly_service_version: env('FASTLY_SERVICE_VERSION'),
      fastly_cache_generation: env('FASTLY_CACHE_GENERATION'),
      fastly_hostname: env('FASTLY_HOSTNAME'),
      fastly_pop: env('FASTLY_POP'),
      fastly_region: env('FASTLY_REGION'),
      fastly_service_id: env('FASTLY_SERVICE_ID'),
      fastly_trace_id: env('FASTLY_TRACE_ID'),
    },
  };

  const url = new URL(req.url);

  if (url.pathname === '/') {
    const flagKey = 'example-flag';
    const variationDetail = await ldClient.boolVariationDetail(flagKey, flagContext, false);

    const output = {
      flagContext,
      flagKey,
      variationDetail,
    };
    event.waitUntil(ldClient.flush());

    return new Response(JSON.stringify(output, undefined, 2), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  }

  if (url.pathname === '/cat') {
    return new Response(cat, {
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    });
  }
  if (url.pathname === '/dog') {
    return new Response(dog, {
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    });
  }
  if (url.pathname === '/animal') {
    const animal = await ldClient.stringVariation('animal', flagContext, 'cat');
    const image = animal === 'cat' ? cat : dog;

    event.waitUntil(ldClient.flush());
    return new Response(image, {
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    });
  }

  // // Catch all other requests and return a 404.
  return new Response('not found', {
    status: 404,
  });
}
