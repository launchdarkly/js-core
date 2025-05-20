import * as fs from 'node:fs';
import * as path from 'node:path';

import { canonicalize } from '../../../src/internal/json/canonicalize';

// Get the test file pairs
const testInputDir = path.join(__dirname, 'testdata', 'input');
const testOutputDir = path.join(__dirname, 'testdata', 'output');
const testFiles = fs.readdirSync(testInputDir);

it.each(testFiles)('should correctly canonicalize %s', (filename) => {
  // Load the input and expected output files
  const inputPath = path.join(testInputDir, filename);
  const outputPath = path.join(testOutputDir, filename);

  const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const expectedOutput = fs.readFileSync(outputPath, 'utf8');

  // Apply the canonicalize function
  const result = canonicalize(inputData);

  // Compare results
  expect(result).toEqual(expectedOutput);
});

it('handles basic arrays', () => {
  const input: any[] = [];
  const expected = '[]';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('handles arrays of null/undefined', () => {
  const input: any[] = [null, undefined];
  const expected = '[null,null]';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('handles objects with numeric keys', () => {
  const input = {
    1: 'one',
    2: 'two',
  };
  const expected = '{"1":"one","2":"two"}';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('handles objects with undefined values', () => {
  const input = {
    a: 'b',
    c: undefined,
  };
  const expected = '{"a":"b"}';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('handles an object with a symbol value', () => {
  const input = {
    a: 'b',
    c: Symbol('c'),
  };
  const expected = '{"a":"b"}';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('handles an object with a symbol key', () => {
  const input = {
    a: 'b',
    [Symbol('c')]: 'd',
  };
  const expected = '{"a":"b"}';
  const result = canonicalize(input);
  expect(result).toEqual(expected);
});

it('should throw an error for objects with cycles', () => {
  const a: any = {};
  const b: any = { a };
  a.b = b;

  expect(() => canonicalize(a)).toThrow('Cycle detected');
});
