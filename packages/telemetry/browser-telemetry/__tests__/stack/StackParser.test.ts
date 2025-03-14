import parse, {
  getLines,
  getSrcLines,
  processUrlToFileName,
  TrimOptions,
  trimSourceLine,
} from '../../src/stack/StackParser';

it.each([
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/', '(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test/(index)', 'test/(index)'],
  ['http://www.launchdarkly.com', 'http://www.launchdarkly.com/test.js', 'test.js'],
  ['http://localhost:8080', 'http://localhost:8080/dist/main.js', 'dist/main.js'],
])('handles URL parsing to file names', (origin: string, url: string, expected: string) => {
  expect(processUrlToFileName(url, origin)).toEqual(expected);
});

it.each([
  ['this is the source line', 5, { maxLength: 10, beforeColumnCharacters: 2 }, 's is the s'],
  ['this is the source line', 0, { maxLength: 10, beforeColumnCharacters: 2 }, 'this is th'],
  ['this is the source line', 2, { maxLength: 10, beforeColumnCharacters: 0 }, 'is is the '],
  ['12345', 0, { maxLength: 5, beforeColumnCharacters: 2 }, '12345'],
  ['this is the source line', 21, { maxLength: 10, beforeColumnCharacters: 2 }, 'line'],
])(
  'trims source lines',
  (source: string, column: number, options: TrimOptions, expected: string) => {
    expect(trimSourceLine(options, source, column)).toEqual(expected);
  },
);

describe('given source lines', () => {
  const lines = ['1234567890', 'ABCDEFGHIJ', '0987654321', 'abcdefghij'];

  it('can get a range which would underflow the lines', () => {
    expect(getLines(-1, 2, lines, (input) => input)).toStrictEqual(['1234567890', 'ABCDEFGHIJ']);
  });

  it('can get a range which would overflow the lines', () => {
    expect(getLines(2, 4, lines, (input) => input)).toStrictEqual(['0987654321', 'abcdefghij']);
  });

  it('can get a range which is satisfied by the lines', () => {
    expect(getLines(0, 4, lines, (input) => input)).toStrictEqual([
      '1234567890',
      'ABCDEFGHIJ',
      '0987654321',
      'abcdefghij',
    ]);
  });
});

describe('given an input stack frame', () => {
  const inputFrame = {
    context: ['1234567890', 'ABCDEFGHIJ', 'the src line', '0987654321', 'abcdefghij'],
    line: 3,
    srcStart: 1,
    column: 0,
  };

  it('can produce a full stack source in the output frame', () => {
    expect(
      getSrcLines(inputFrame, {
        enabled: true,
        source: {
          beforeLines: 2,
          afterLines: 2,
          maxLineLength: 280,
        },
      }),
    ).toMatchObject({
      srcBefore: ['1234567890', 'ABCDEFGHIJ'],
      srcLine: 'the src line',
      srcAfter: ['0987654321', 'abcdefghij'],
    });
  });

  it('can trim all the lines', () => {
    expect(
      getSrcLines(inputFrame, {
        enabled: true,
        source: {
          beforeLines: 2,
          afterLines: 2,
          maxLineLength: 1,
        },
      }),
    ).toMatchObject({
      srcBefore: ['1', 'A'],
      srcLine: 't',
      srcAfter: ['0', 'a'],
    });
  });

  it('can handle fewer input lines than the expected context', () => {
    expect(
      getSrcLines(inputFrame, {
        enabled: true,
        source: {
          beforeLines: 3,
          afterLines: 3,
          maxLineLength: 280,
        },
      }),
    ).toMatchObject({
      srcBefore: ['1234567890', 'ABCDEFGHIJ'],
      srcLine: 'the src line',
      srcAfter: ['0987654321', 'abcdefghij'],
    });
  });

  it('can handle more input lines than the expected context', () => {
    expect(
      getSrcLines(inputFrame, {
        enabled: true,
        source: {
          beforeLines: 1,
          afterLines: 1,
          maxLineLength: 280,
        },
      }),
    ).toMatchObject({
      srcBefore: ['ABCDEFGHIJ'],
      srcLine: 'the src line',
      srcAfter: ['0987654321'],
    });
  });
});

it('can handle an origin before the context window', () => {
  // This isn't expected, but we just want to make sure it is handle gracefully.
  const inputFrame = {
    context: ['1234567890', 'ABCDEFGHIJ', 'the src line', '0987654321', 'abcdefghij'],
    line: 3,
    srcStart: 5,
    column: 0,
  };

  expect(
    getSrcLines(inputFrame, {
      enabled: true,
      source: {
        beforeLines: 1,
        afterLines: 1,
        maxLineLength: 280,
      },
    }),
  ).toMatchObject({
    srcBefore: [],
    srcLine: '1234567890',
    srcAfter: ['ABCDEFGHIJ'],
  });
});

it('can handle an origin after the context window', () => {
  // This isn't expected, but we just want to make sure it is handle gracefully.
  const inputFrame = {
    context: ['1234567890', 'ABCDEFGHIJ', 'the src line', '0987654321', 'abcdefghij'],
    line: 100,
    srcStart: 5,
    column: 0,
  };

  expect(
    getSrcLines(inputFrame, {
      enabled: true,
      source: {
        beforeLines: 1,
        afterLines: 1,
        maxLineLength: 280,
      },
    }),
  ).toMatchObject({
    srcBefore: ['0987654321'],
    srcLine: 'abcdefghij',
    srcAfter: [],
  });
});

it('returns an empty stack when stack parsing is disabled', () => {
  expect(
    parse(new Error('test'), {
      enabled: false,
      source: {
        beforeLines: 1,
        afterLines: 1,
        maxLineLength: 280,
      },
    }),
  ).toEqual({ frames: [] });
});
