import ErrorCollector from '../src/collectors/error';
import parse, { defaultOptions } from '../src/options';

it('handles an empty configuration', () => {
  const outOptions = parse({});
  expect(outOptions).toEqual(defaultOptions());
});

it('can set each option', () => {
  const outOptions = parse({
    maxPendingEvents: 1,
    breadcrumbs: {
      maxBreadcrumbs: 1,
      click: false,
      evaluations: false,
      flagChange: false,
    },
    collectors: [new ErrorCollector(), new ErrorCollector()],
  });
  expect(outOptions).toEqual({
    maxPendingEvents: 1,
    breadcrumbs: {
      maxBreadcrumbs: 1,
      click: false,
      evaluations: false,
      flagChange: false,
      http: {
        instrumentFetch: true,
        instrumentXhr: true,
      },
    },
    stack: {
      source: {
        beforeLines: 3,
        afterLines: 3,
        maxLineLength: 280,
      },
    },
    collectors: [new ErrorCollector(), new ErrorCollector()],
  });
});
