import { initMetadataFromHeaders } from '../../../src/internal/metadata';

it('handles passing undefined headers', () => {
  expect(initMetadataFromHeaders()).toBeUndefined();
});

it('handles missing x-ld-envid header', () => {
  expect(initMetadataFromHeaders({})).toBeUndefined();
});

it('retrieves environmentId from headers', () => {
  expect(initMetadataFromHeaders({ 'x-ld-envid': '12345' })).toEqual({ environmentId: '12345' });
});

it('retrieves environmentId from mixed case header', () => {
  expect(initMetadataFromHeaders({ 'X-LD-EnvId': '12345' })).toEqual({ environmentId: '12345' });
});
