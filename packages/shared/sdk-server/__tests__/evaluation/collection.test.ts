import { allAsync, allSeriesAsync, firstSeriesAsync } from '../../src/evaluation/collection';

// The series helpers recurse synchronously for small collections and defer to a resolved
// promise once a collection has more than 50 items, so a throw after that point happens off the
// caller's stack. Both sizes are exercised. Each run settles on whichever callback fires first,
// so a result delivered where an error was expected fails the assertion rather than hanging. If
// a helper swallowed an exception and called neither callback, the test would time out.
const smallCollection = [0, 1, 2];
const largeCollection = Array.from({ length: 60 }, (_, index) => index);

type SeriesHelper = typeof allSeriesAsync;
type SeriesCheck = Parameters<SeriesHelper>[1];
type Outcome = { result: boolean | null | undefined } | { error: unknown };

function runSeries(
  helper: SeriesHelper,
  collection: unknown,
  check: SeriesCheck,
): Promise<Outcome> {
  return new Promise<Outcome>((resolve) => {
    helper(
      collection as number[],
      check,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );
  });
}

function runAll(collection: number[], check: Parameters<typeof allAsync>[1]): Promise<Outcome> {
  return new Promise<Outcome>((resolve) => {
    allAsync(
      collection,
      check,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );
  });
}

describe.each<[string, SeriesHelper, boolean]>([
  // The third column is the value a check must produce for iteration to move to the next item.
  ['allSeriesAsync', allSeriesAsync, true],
  ['firstSeriesAsync', firstSeriesAsync, false],
])('%s', (_name, helper, continueValue) => {
  it('calls cb with the aggregate result when no check throws', async () => {
    const outcome = await runSeries(helper, largeCollection, (_item, _index, itemCb) =>
      itemCb(continueValue),
    );
    expect(outcome).toEqual({ result: continueValue });
  });

  it.each<[string, number[], number]>([
    ['a small', smallCollection, 1],
    ['a large', largeCollection, 55],
  ])(
    'reports an exception from a check in %s collection through onError',
    async (_description, collection, throwAt) => {
      const outcome = await runSeries(helper, collection, (item, _index, itemCb) => {
        if (item === throwAt) {
          throw new Error(`boom at ${item}`);
        }
        itemCb(continueValue);
      });
      expect(outcome).toEqual({ error: new Error(`boom at ${throwAt}`) });
    },
  );

  it('reports an exception from the completion callback after an asynchronous check', async () => {
    // Once a check calls back from a promise, the rest of the iteration runs in that
    // continuation, where the try/catch around the original call is no longer on the stack.
    // The first item ends the iteration early, so the completion callback runs there directly.
    const error = await new Promise<unknown>((resolve) => {
      helper(
        smallCollection,
        (_item, _index, itemCb) => {
          Promise.resolve().then(() => itemCb(!continueValue));
        },
        () => {
          throw new Error('from cb after async callback');
        },
        resolve,
      );
    });
    expect(error).toEqual(new Error('from cb after async callback'));
  });

  it('reports an exception from the completion callback through onError', async () => {
    const error = await new Promise<unknown>((resolve) => {
      helper(
        smallCollection,
        (_item, _index, itemCb) => itemCb(continueValue),
        () => {
          throw new Error('from cb');
        },
        resolve,
      );
    });
    expect(error).toEqual(new Error('from cb'));
  });

  it('reports a collection that is not an array through onError without running a check', async () => {
    const check = jest.fn((_item, _index, itemCb) => itemCb(continueValue));
    const outcome = await runSeries(helper, {}, check);
    expect(outcome).toEqual({ error: new TypeError('Expected an array but received object') });
    expect(check).not.toHaveBeenCalled();
  });
});

describe('allAsync', () => {
  it('calls cb with true when every check passes', async () => {
    const outcome = await runAll(largeCollection, (_item, itemCb) => itemCb(true));
    expect(outcome).toEqual({ result: true });
  });

  it('reports an exception from a check through onError', async () => {
    const outcome = await runAll(smallCollection, (item, itemCb) => {
      if (item === 1) {
        throw new Error('boom at 1');
      }
      itemCb(true);
    });
    expect(outcome).toEqual({ error: new Error('boom at 1') });
  });

  it('reports an exception from the completion callback through onError', async () => {
    const error = await new Promise<unknown>((resolve) => {
      allAsync(
        smallCollection,
        (_item, itemCb) => itemCb(true),
        () => {
          throw new Error('from cb');
        },
        resolve,
      );
    });
    expect(error).toEqual(new Error('from cb'));
  });
});
