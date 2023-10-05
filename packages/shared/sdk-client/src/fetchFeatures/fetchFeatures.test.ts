import fetchMock from 'jest-fetch-mock';

import { LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import Configuration from '../configuration';
import fetchFeatures from './fetchFeatures';
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
  const reportHeaders = {
    authorization: 'testSdkKey1',
    'content-type': 'application/json',
    'user-agent': 'TestUserAgent/2.0.2',
    'x-launchdarkly-wrapper': 'Rapper/1.2.3',
  };

  let config: Configuration;

  beforeEach(() => {
    fetchMock.mockOnce(JSON.stringify(mockResponse));
    config = new Configuration();
  });

  afterEach(() => {
    fetchMock.resetMocks();
    jest.resetAllMocks();
  });

  test('get', async () => {
    const json = await fetchFeatures(sdkKey, context, config, basicPlatform);

    expect(fetchMock).toBeCalledWith(
      'https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/contexts/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
      {
        method: 'GET',
        headers: getHeaders,
      },
    );
    expect(json).toEqual(mockResponse);
  });

  test('report', async () => {
    config = new Configuration({ useReport: true });
    const json = await fetchFeatures(sdkKey, context, config, basicPlatform);

    expect(fetchMock).toBeCalledWith('https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/context', {
      method: 'REPORT',
      headers: reportHeaders,
      body: '{"kind":"user","key":"test-user-key-1"}',
    });
    expect(json).toEqual(mockResponse);
  });

  test('withReasons', async () => {
    fetchMock.resetMocks();
    fetchMock.mockOnce(JSON.stringify(mockResponseWithReasons));
    config = new Configuration({ withReasons: true });
    const json = await fetchFeatures(sdkKey, context, config, basicPlatform);

    expect(fetchMock).toBeCalledWith(
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
    const json = await fetchFeatures(sdkKey, context, config, basicPlatform);

    expect(fetchMock).toBeCalledWith(
      'https://sdk.launchdarkly.com/sdk/evalx/testSdkKey1/contexts/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9?h=test-hash',
      {
        method: 'GET',
        headers: getHeaders,
      },
    );
    expect(json).toEqual(mockResponse);
  });
});
