/* eslint-disable no-restricted-syntax */
// The header interface uses generators, so we are using restricted-syntax.
import * as http from 'http';

import HeaderWrapper from '../../src/platform/HeaderWrapper';

describe('given header values', () => {
  const headers: http.IncomingHttpHeaders = {
    accept: 'anything',
    'some-header': 'some-value',
    'some-array': ['a', 'b'],
  };
  const wrapper = new HeaderWrapper(headers);

  it('can get a single value header', () => {
    expect(wrapper.get('accept')).toEqual('anything');
  });

  it('can get an array value header', () => {
    expect(wrapper.get('some-array')).toEqual('a, b');
  });

  it('can get the entries', () => {
    const flat: Array<[string, string]> = [];
    for (const entry of wrapper.entries()) {
      flat.push(entry);
    }
    expect(flat).toEqual([
      ['accept', 'anything'],
      ['some-header', 'some-value'],
      ['some-array', 'a, b'],
    ]);
  });

  it('can check if a value is present', () => {
    expect(wrapper.has('accept')).toBeTruthy();
    expect(wrapper.has('potato')).toBeFalsy();
  });

  it('can key the keys', () => {
    const keys: string[] = [];
    for (const key of wrapper.keys()) {
      keys.push(key);
    }
    expect(keys).toEqual(['accept', 'some-header', 'some-array']);
  });

  it('can key the values', () => {
    const values: string[] = [];
    for (const value of wrapper.values()) {
      values.push(value);
    }
    expect(values).toEqual(['anything', 'some-value', 'a, b']);
  });
});
