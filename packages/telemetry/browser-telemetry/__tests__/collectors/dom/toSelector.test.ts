import toSelector, { elementToString, getClassName } from '../../../src/collectors/dom/toSelector';

it.each([
  [{}, undefined],
  [{ className: '' }, undefined],
  [{ className: 'potato' }, '.potato'],
  [{ className: 'cheese potato' }, '.cheese.potato'],
])('can format class names', (element: any, expected?: string) => {
  expect(getClassName(element)).toBe(expected);
});

it.each([
  [{}, ''],
  [{ tagName: 'DIV' }, 'div'],
  [{ tagName: 'P', id: 'test' }, 'p#test'],
  [{ tagName: 'P', className: 'bold' }, 'p.bold'],
  [{ tagName: 'P', className: 'bold', id: 'test' }, 'p#test.bold'],
])('can format an element as a string', (element: any, expected: string) => {
  expect(elementToString(element)).toBe(expected);
});

it.each([
  [{}, ''],
  [undefined, ''],
  [null, ''],
  ['toaster', ''],
  [
    {
      tagName: 'BODY',
      parentNode: {
        tagName: 'HTML',
      },
    },
    'body',
  ],
  [
    {
      tagName: 'DIV',
      parentNode: {
        tagName: 'BODY',
        parentNode: {
          tagName: 'HTML',
        },
      },
    },
    'body > div',
  ],
  [
    {
      tagName: 'DIV',
      className: 'cheese taco',
      id: 'taco',
      parentNode: {
        tagName: 'BODY',
        parentNode: {
          tagName: 'HTML',
        },
      },
    },
    'body > div#taco.cheese.taco',
  ],
])('can produce a CSS selector from a dom element', (element: any, expected: string) => {
  expect(toSelector(element)).toBe(expected);
});

it('respects max depth', () => {
  const element = {
    tagName: 'DIV',
    className: 'cheese taco',
    id: 'taco',
    parentNode: {
      tagName: 'P',
      parentNode: {
        tagName: 'BODY',
        parentNode: {
          tagName: 'HTML',
        },
      },
    },
  };

  expect(toSelector(element, { maxDepth: 1 })).toBe('div#taco.cheese.taco');
  expect(toSelector(element, { maxDepth: 2 })).toBe('p > div#taco.cheese.taco');
});
