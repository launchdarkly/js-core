import { NullEventSource } from '@launchdarkly/js-server-sdk-common';
import type {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Options,
  platform,
} from '@launchdarkly/js-server-sdk-common';

import { OxygenCacheOptions } from '../utils/validateOptions';

export default class OxygenRequests implements platform.Requests {
  // @ts-ignore - Cache API is available in Shopify Oxygen runtime
  private _cache: Cache | null = null;
  private _cacheOptions: OxygenCacheOptions;
  // @ts-ignore - Cache API is available in Shopify Oxygen runtime
  private _cacheInitPromise: Promise<Cache | null>;

  constructor(cacheOptions: OxygenCacheOptions = {}) {
    this._cacheOptions = cacheOptions;

    const { enabled, name } = this._cacheOptions;

    if (enabled && name) {
      this._cacheInitPromise = this.initializeCache(name);
    }
  }

  // @ts-ignore - Cache API is available in Shopify Oxygen runtime
  private async initializeCache(cacheName: string): Promise<Cache | null> {
    try {
      // Check if Cache API is available
      // @ts-ignore - Cache API is available in Shopify Oxygen runtime
      if (typeof caches !== 'undefined') {
        // @ts-ignore - Cache API is available in Shopify Oxygen runtime
        this._cache = await caches.open(cacheName);
        return this._cache;
      }
    } catch (err) {
      throw err;
    }
    return null;
  }

  private async addCacheControlHeaders(response: Response): Promise<Response> {
    // Read the body first to ensure the stream is consumed
    const { ttlSeconds } = this._cacheOptions;
    const body = await response.arrayBuffer();
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    newHeaders.set('Date', new Date().toUTCString());

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  async fetch(url: string, options: Options = {}): Promise<platform.Response> {
    // Ensure cache is initialized
    const cache = this._cache || (await this._cacheInitPromise);
    if (!cache || !(options.method && options.method.toLowerCase() === 'get')) {
      // Fall back to direct fetch if one of the following conditions are met:
      // - Cache API not available
      // - Cache is not enabled per initialization options
      // - Not a GET request (for now, we mostly interested in caching the feature poll request)
      return fetch(url, options);
    }

    const request = new Request(url, {
      method: options.method || 'GET',
      ...options,
    });

    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse as platform.Response;
    }
    return this.fetchAndCache(url, options, request, cache);
  }

  private async fetchAndCache(
    url: string,
    options: Options,
    request: Request,
    // @ts-ignore - Cache API is available in Shopify Oxygen runtime
    cache: Cache,
  ): Promise<platform.Response> {
    const response = await fetch(url, options);

    // Only cache successful GET requests
    if (cache && response.ok && (!options.method || options.method === 'GET')) {
      // Clone the response to get two branches: one for caching, one for returning
      const responseClone = response.clone();
      const responseWithCacheControl = await this.addCacheControlHeaders(responseClone);
      
      // Cache the response (don't await to avoid blocking)
      // The Cache API will consume the response body
      cache.put(request, responseWithCacheControl).catch(() => {
        // Ignore cache errors, we'll try again next time
      });
      
      return response as platform.Response;
    }

    return response as platform.Response;
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new NullEventSource(url, eventSourceInitDict);
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: false,
      headers: false,
      customMethod: false,
    };
  }
}
