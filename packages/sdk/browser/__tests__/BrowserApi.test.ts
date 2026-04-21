import { isDocument, isWindow } from '../src/BrowserApi';

it('isDocument returns true when document is defined', () => {
  expect(isDocument()).toBe(true);
});

it('isWindow returns true when window is defined', () => {
  expect(isWindow()).toBe(true);
});
