import {
  classifyHttpStatus,
  classifyTransportFailure,
} from '../../../src/datasource/retry/classification';

it.each([400, 408, 429])('classifies %i as a normal failure', (status) => {
  expect(classifyHttpStatus(status)).toEqual('normal');
});

it.each([401, 403, 404, 418, 451, 499])('classifies %i as an unexpected failure', (status) => {
  expect(classifyHttpStatus(status)).toEqual('unexpected');
});

it.each([500, 502, 503, 504, 599])('classifies server error %i as a normal failure', (status) => {
  expect(classifyHttpStatus(status)).toEqual('normal');
});

it.each([0, 100, 200, 301, 304, 399, 600])(
  'classifies non-error-range status %i as a normal failure',
  (status) => {
    expect(classifyHttpStatus(status)).toEqual('normal');
  },
);

it('classifies transport failures as normal', () => {
  expect(classifyTransportFailure()).toEqual('normal');
});
