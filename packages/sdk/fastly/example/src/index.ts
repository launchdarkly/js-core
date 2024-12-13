//! Default Compute template program.
/// <reference types="@fastly/js-compute" />
// import { CacheOverride } from "fastly:cache-override";
import { env } from 'fastly:env';
import { allowDynamicBackends, includeBytes } from 'fastly:experimental';
import { KVStore } from 'fastly:kv-store';
import { Logger } from 'fastly:logger';

import { init } from '@launchdarkly/fastly-server-sdk';
import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDClient } from '@launchdarkly/js-server-sdk-common-edge';

// Load a static file as a Uint8Array at compile time.
// File path is relative to root of project, not to this file
const welcomePage = includeBytes('./src/welcome-to-compute.html');

// The entry point for your application.
//
// Use this fetch event listener to define your main request handling logic. It
// could be used to route based on the request properties (such as method or
// path), send the request to a backend, make completely new requests, and/or
// generate synthetic responses.

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function flushEvents(ldClient: LDClient) {
  console.log('Flushing events');
  await ldClient.flush();
  console.log('Events flushed');
}

async function handleRequest(event: FetchEvent) {
  const logger = new Logger('handleRequest');

  // Log service version
  console.log('FASTLY_SERVICE_VERSION:', env('FASTLY_SERVICE_VERSION') || 'local');

  // Get the client request.
  let req = event.request;

  // Filter requests that have unexpected methods.
  if (!['HEAD', 'GET', 'PURGE'].includes(req.method)) {
    return new Response('This method is not allowed', {
      status: 405,
    });
  }

  let url = new URL(req.url);

  // If request is to the `/` path...
  if (url.pathname == '/') {
    // Below are some common patterns for Fastly Compute services using JavaScript.
    // Head to https://developer.fastly.com/learning/compute/javascript/ to discover more.

    // Create a new request.
    // let bereq = new Request("http://example.com");

    // Add request headers.
    // req.headers.set("X-Custom-Header", "Welcome to Fastly Compute!");
    // req.headers.set(
    //   "X-Another-Custom-Header",
    //   "Recommended reading: https://developer.fastly.com/learning/compute"
    // );

    // Create a cache override.
    // To use this, uncomment the import statement at the top of this file for CacheOverride.
    // let cacheOverride = new CacheOverride("override", { ttl: 60 });

    // Forward the request to a backend.
    // let beresp = await fetch(req, {
    //   backend: "backend_name",
    //   cacheOverride,
    // });

    // Remove response headers.
    // beresp.headers.delete("X-Another-Custom-Header");

    // Log to a Fastly endpoint.
    // To use this, uncomment the import statement at the top of this file for Logger.
    // const logger = new Logger("my_endpoint");
    // logger.log("Hello from the edge!");

    // Send a default synthetic response.

    return new Response(welcomePage, {
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    });
  }

  const store = new KVStore('testkv');
  const ldClient = init(store, '675aea6b1b327709c85da941', {
    sendEvents: true,
  });
  await ldClient.waitForInitialization();
  const flagKey = 'enable-2025-brand-refresh';
  const flagContext: LDContext = {
    key: 'test-user',
    custom: {
      fastly_service_version: env('FASTLY_SERVICE_VERSION'),
      fastly_cache_generation: env('FASTLY_CACHE_GENERATION'),
      fastly_hostname: env('FASTLY_HOSTNAME'),
      fastly_pop: env('FASTLY_POP'),
      fastly_region: env('FASTLY_REGION'),
      fastly_service_id: env('FASTLY_SERVICE_ID'),
      fastly_trace_id: env('FASTLY_TRACE_ID'),
    },
  };
  const variationDetail = await ldClient.boolVariationDetail(flagKey, flagContext, false);
  logger.log(`Flag value: ${variationDetail}`);

  const output = {
    flagContext,
    variationDetail: variationDetail,
  };
  event.waitUntil(flushEvents(ldClient));
  await flushEvents(ldClient);

  // // Catch all other requests and return a 404.
  // const text = (await readme?.text()) || 'The page you requested could not be found';
  return new Response(JSON.stringify(output, undefined, 2), {
    status: 404,
    headers: new Headers({ 'Content-Type': 'application/json' }),
  });
}
