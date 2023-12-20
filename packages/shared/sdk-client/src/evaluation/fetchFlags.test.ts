import { LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform, mockFetch } from '@launchdarkly/private-js-mocks';

import Configuration from '../configuration';
import fetchFlags from './fetchFlags';
import * as mockResponse from './mockResponse.json';
import * as mockResponseWithReasons from './mockResponseWithReasons.json';

describe('fetchFeatures', () => {
  const sdkKey = 'testSdkKey1';
  const context: LDContext = { kind: 'user', key: 'test-user-key-1' };
  const getHeaders = {
    authorization: 'testSdkKey1',
    'user-agent': 'TestUserAgent/2.0.2',
    'x-launchdarkly-wrapper': 'Rapper/1.2.3',
  };

  let config: Configuration;
  const platformFetch = basicPlatform.requests.fetch as jest.Mock;

  beforeEach(() => {
    mockFetch(mockResponse);
    config = new Configuration();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('get', async () => {
    const json = await fetchFlags(sdkKey, context, config, basicPlatform);

    expect(platformFetch).toBeCalledWith(
      'https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/contexts/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
      {
        method: 'GET',
        headers: getHeaders,
      },
    );
    expect(json).toEqual(mockResponse);
  });

  test('withReasons', async () => {
    mockFetch(mockResponseWithReasons);
    config = new Configuration({ withReasons: true });
    const json = await fetchFlags(sdkKey, context, config, basicPlatform);

    expect(platformFetch).toBeCalledWith(
      'https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/contexts/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9?withReasons=true',
      {
        method: 'GET',
        headers: getHeaders,
      },
    );
    expect(json).toEqual(mockResponseWithReasons);
  });

  test('hash', async () => {
    config = new Configuration({ hash: 'test-hash', withReasons: false });
    const json = await fetchFlags(sdkKey, context, config, basicPlatform);

    expect(platformFetch).toBeCalledWith(
      'https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/contexts/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9?h=test-hash',
      {
        method: 'GET',
        headers: getHeaders,
      },
    );
    expect(json).toEqual(mockResponse);
  });
});
