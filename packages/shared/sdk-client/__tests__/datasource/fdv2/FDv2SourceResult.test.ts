import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import {
  changeSet,
  errorInfoFromHttpError,
  errorInfoFromInvalidData,
  errorInfoFromNetworkError,
  errorInfoFromUnknown,
  goodbye,
  interrupted,
  shutdown,
  terminalError,
} from '../../../src/datasource/fdv2/FDv2SourceResult';

it('creates a changeSet result with a payload', () => {
  const payload = {
    id: 'test-id',
    version: 1,
    state: 'some-state',
    type: 'full' as const,
    updates: [],
  };
  const result = changeSet(payload, false, 'env-123');

  expect(result.type).toBe('changeSet');
  expect(result).toEqual({
    type: 'changeSet',
    payload,
    fdv1Fallback: false,
    environmentId: 'env-123',
  });
});

it('creates a changeSet result with fdv1Fallback flag', () => {
  const payload = { id: 'id', version: 1, type: 'full' as const, updates: [] };
  const result = changeSet(payload, true);

  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.fdv1Fallback).toBe(true);
  }
});

it('creates an interrupted status result', () => {
  const errorInfo = {
    kind: DataSourceErrorKind.NetworkError,
    message: 'connection reset',
    time: 1000,
  };
  const result = interrupted(errorInfo, false);

  expect(result).toEqual({
    type: 'status',
    state: 'interrupted',
    errorInfo,
    fdv1Fallback: false,
  });
});

it('creates a shutdown status result', () => {
  const result = shutdown();

  expect(result).toEqual({
    type: 'status',
    state: 'shutdown',
    fdv1Fallback: false,
  });
});

it('creates a terminal error status result', () => {
  const errorInfo = {
    kind: DataSourceErrorKind.ErrorResponse,
    message: 'Unauthorized',
    statusCode: 401,
    time: 2000,
  };
  const result = terminalError(errorInfo, true);

  expect(result).toEqual({
    type: 'status',
    state: 'terminal_error',
    errorInfo,
    fdv1Fallback: true,
  });
});

it('creates a goodbye status result', () => {
  const result = goodbye('server-shutdown', false);

  expect(result).toEqual({
    type: 'status',
    state: 'goodbye',
    reason: 'server-shutdown',
    fdv1Fallback: false,
  });
});

it('creates error info from an HTTP status code', () => {
  const info = errorInfoFromHttpError(503);

  expect(info.kind).toBe(DataSourceErrorKind.ErrorResponse);
  expect(info.message).toBe('Unexpected status code: 503');
  expect(info.statusCode).toBe(503);
  expect(info.time).toBeGreaterThan(0);
});

it('creates error info from a network error', () => {
  const info = errorInfoFromNetworkError('ECONNREFUSED');

  expect(info.kind).toBe(DataSourceErrorKind.NetworkError);
  expect(info.message).toBe('ECONNREFUSED');
  expect(info.time).toBeGreaterThan(0);
});

it('creates error info from invalid data', () => {
  const info = errorInfoFromInvalidData('malformed JSON');

  expect(info.kind).toBe(DataSourceErrorKind.InvalidData);
  expect(info.message).toBe('malformed JSON');
});

it('creates error info for unknown errors', () => {
  const info = errorInfoFromUnknown('something went wrong');

  expect(info.kind).toBe(DataSourceErrorKind.Unknown);
  expect(info.message).toBe('something went wrong');
});
