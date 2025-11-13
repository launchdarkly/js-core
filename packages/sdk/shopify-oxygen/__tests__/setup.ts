/* eslint-disable import/no-extraneous-dependencies */
import { jest } from '@jest/globals';

import * as allFlagsSegments from './testData.json';

// @ts-ignore
global.setInterval = () => ({}) as any;

// @ts-ignore
global.clearInterval = () => {};

// @ts-ignore
global.setTimeout = () => ({}) as any;

// @ts-ignore
global.clearTimeout = () => {};

// Setup test environment with mocks
export const setupTestEnvironment = async () => {
  // Setup Cache API mock
  const matchFn = jest.fn();
  // @ts-ignore - Mock implementation
  matchFn.mockResolvedValue(undefined);
  const putFn = jest.fn();
  // @ts-ignore - Mock implementation
  putFn.mockResolvedValue(undefined);
  const mockCache = {
    match: matchFn as any,
    put: putFn as any,
  };

  const openFn = jest.fn();
  // @ts-ignore - Mock implementation
  openFn.mockResolvedValue(mockCache);
  // @ts-ignore - Mock Cache API for testing
  global.caches = {
    open: openFn as any,
  };

  // @ts-ignore - Mock implementation
  global.fetch = jest.fn<typeof fetch>((url: string) => {
    // Match any URL containing /sdk/latest-all which should be the only URL that we are interested in.
    if (url.includes('/sdk/latest-all') || url.endsWith('/sdk/latest-all')) {
      const jsonFn = jest.fn();
      // @ts-ignore - Mock implementation
      jsonFn.mockResolvedValue(allFlagsSegments);
      const textFn = jest.fn();
      // @ts-ignore - Mock implementation
      textFn.mockResolvedValue(JSON.stringify(allFlagsSegments));
      const arrayBufferFn = jest.fn();
      // @ts-ignore - Mock implementation
      arrayBufferFn.mockResolvedValue(new ArrayBuffer(0));
      const mockResponse: any = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jsonFn,
        text: textFn,
        arrayBuffer: arrayBufferFn,
        clone: jest.fn().mockReturnThis(),
      };
      return Promise.resolve(mockResponse);
    }

    const jsonFn = jest.fn();
    // @ts-ignore - Mock implementation
    jsonFn.mockResolvedValue({});
    const textFn = jest.fn();
    // @ts-ignore - Mock implementation
    textFn.mockResolvedValue('');
    const arrayBufferFn = jest.fn();
    // @ts-ignore - Mock implementation
    arrayBufferFn.mockResolvedValue(new ArrayBuffer(0));
    const mockResponse: any = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: jsonFn,
      text: textFn,
      arrayBuffer: arrayBufferFn,
    };
    return Promise.resolve(mockResponse);
  });
};
