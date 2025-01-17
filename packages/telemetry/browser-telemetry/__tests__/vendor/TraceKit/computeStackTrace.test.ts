/**
 * https://github.com/csnover/TraceKit
 * @license MIT
 * @namespace TraceKit
 */
import { getTraceKit } from '../../../src/vendor/TraceKit';
import * as CapturedExceptions from './CapturedExceptions';

/* eslint-disable no-plusplus */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-use-before-define */

describe('computeStackTrace', () => {
  describe('domain regex', () => {
    const regex = /(.*)\:\/\/([^\/]+)\/{0,1}([\s\S]*)/;
    it('should return subdomains properly', () => {
      const url = 'https://subdomain.yoursite.com/assets/main.js';
      const domain = 'subdomain.yoursite.com';
      expect(regex.exec(url)![2]).toBe(domain);
    });
    it('should return domains correctly with any protocol', () => {
      const url = 'http://yoursite.com/assets/main.js';
      const domain = 'yoursite.com';
      expect(regex.exec(url)![2]).toBe(domain);
    });
    it('should return the correct domain when directories match the domain', () => {
      const url = 'https://mysite.com/mysite/main.js';
      const domain = 'mysite.com';
      expect(regex.exec(url)![2]).toBe(domain);
    });
  });
});

describe('Parser', () => {
  function foo() {
    return bar();
  }

  function bar() {
    return baz();
  }

  function baz() {
    return getTraceKit().computeStackTrace.ofCaller();
  }

  it('should get the order of functions called right', () => {
    const trace = foo();
    const expected = ['baz', 'bar', 'foo'];
    for (let i = 1; i <= 3; i++) {
      expect(trace.stack[i].func).toBe(expected[i - 1]);
    }
  });

  it('should parse Safari 6 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.SAFARI_6 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(4);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 48,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'dumpException3',
      args: [],
      line: 52,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'onclick',
      args: [],
      line: 82,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: '[native code]',
      func: '?',
      args: [],
      line: null,
      column: null,
      context: null,
    });
  });

  it('should parse Safari 7 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.SAFARI_7);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 48,
      column: 22,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 52,
      column: 15,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 108,
      column: 107,
      context: null,
    });
  });

  it('should parse Safari 8 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.SAFARI_8);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 47,
      column: 22,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 52,
      column: 15,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 108,
      column: 23,
      context: null,
    });
  });

  it('should parse Safari 8 eval error', () => {
    // TODO: Take into account the line and column properties on the error object and use them for the first stack trace.
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.SAFARI_8_EVAL);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: '[native code]',
      func: 'eval',
      args: [],
      line: null,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 58,
      column: 21,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 109,
      column: 91,
      context: null,
    });
  });

  it('should parse Firefox 3 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.FIREFOX_3);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://127.0.0.1:8000/js/stacktrace.js',
      func: '?',
      args: [],
      line: 44,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://127.0.0.1:8000/js/stacktrace.js',
      func: '?',
      args: ['null'],
      line: 31,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://127.0.0.1:8000/js/stacktrace.js',
      func: 'printStackTrace',
      args: [],
      line: 18,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://127.0.0.1:8000/js/file.js',
      func: 'bar',
      args: ['1'],
      line: 13,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://127.0.0.1:8000/js/file.js',
      func: 'bar',
      args: ['2'],
      line: 16,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://127.0.0.1:8000/js/file.js',
      func: 'foo',
      args: [],
      line: 20,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'http://127.0.0.1:8000/js/file.js',
      func: '?',
      args: [],
      line: 24,
      column: null,
      context: null,
    });
  });

  it('should parse Firefox 7 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.FIREFOX_7 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'file:///G:/js/stacktrace.js',
      func: '?',
      args: [],
      line: 44,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'file:///G:/js/stacktrace.js',
      func: '?',
      args: ['null'],
      line: 31,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'file:///G:/js/stacktrace.js',
      func: 'printStackTrace',
      args: [],
      line: 18,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'file:///G:/js/file.js',
      func: 'bar',
      args: ['1'],
      line: 13,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'file:///G:/js/file.js',
      func: 'bar',
      args: ['2'],
      line: 16,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'file:///G:/js/file.js',
      func: 'foo',
      args: [],
      line: 20,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'file:///G:/js/file.js',
      func: '?',
      args: [],
      line: 24,
      column: null,
      context: null,
    });
  });

  it('should parse Firefox 14 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.FIREFOX_14 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 48,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'dumpException3',
      args: [],
      line: 52,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'onclick',
      args: [],
      line: 1,
      column: null,
      context: null,
    });
  });

  it('should parse Firefox 31 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.FIREFOX_31);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 41,
      column: 13,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 1,
      column: 1,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: '.plugin/e.fn[c]/<',
      args: [],
      line: 1,
      column: 1,
      context: null,
    });
  });

  it('should parse Firefox 44 ns exceptions', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.FIREFOX_44_NS_EXCEPTION);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(4);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '[2]</Bar.prototype._baz/</<',
      args: [],
      line: 703,
      column: 28,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'file:///path/to/file.js',
      func: 'App.prototype.foo',
      args: [],
      line: 15,
      column: 2,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'file:///path/to/file.js',
      func: 'bar',
      args: [],
      line: 20,
      column: 3,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'file:///path/to/index.html',
      func: '?',
      args: [],
      line: 23,
      column: 1,
      context: null,
    });
  });

  it('should parse Chrome error with no location', () => {
    const stackFrames = getTraceKit().computeStackTrace({
      stack: 'error\n at Array.forEach (native)',
    } as unknown as Error);
    expect(stackFrames.stack.length).toBe(1);
    expect(stackFrames.stack[0]).toEqual({
      url: null,
      func: 'Array.forEach',
      args: ['native'],
      line: null,
      column: null,
      context: null,
    });
  });

  it('should parse Chrome 15 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.CHROME_15 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(4);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 13,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 16,
      column: 5,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 20,
      column: 5,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 24,
      column: 4,
      context: null,
    });
  });

  it('should parse Chrome 36 error with port numbers', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.CHROME_36);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'dumpExceptionError',
      args: [],
      line: 41,
      column: 27,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'HTMLButtonElement.onclick',
      args: [],
      line: 107,
      column: 146,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'I.e.fn.(anonymous function) [as index]',
      args: [],
      line: 10,
      column: 3651,
      context: null,
    });
  });

  it('should parse Chrome error with webpack URLs', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.CHROME_XX_WEBPACK);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(4);
    expect(stackFrames.stack[0]).toEqual({
      url: 'webpack:///./src/components/test/test.jsx?',
      func: 'TESTTESTTEST.eval',
      args: [],
      line: 295,
      column: 108,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'webpack:///./src/components/test/test.jsx?',
      func: 'TESTTESTTEST.render',
      args: [],
      line: 272,
      column: 32,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'webpack:///./~/react-transform-catch-errors/lib/index.js?',
      func: 'TESTTESTTEST.tryRender',
      args: [],
      line: 34,
      column: 31,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'webpack:///./~/react-proxy/modules/createPrototypeProxy.js?',
      func: 'TESTTESTTEST.proxiedMethod',
      args: [],
      line: 44,
      column: 30,
      context: null,
    });
  });

  it('should parse nested eval() from Chrome', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.CHROME_48_EVAL);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(5);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'baz',
      args: [],
      line: 21,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'foo',
      args: [],
      line: 21,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'eval',
      args: [],
      line: 21,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'Object.speak',
      args: [],
      line: 21,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: '?',
      args: [],
      line: 31,
      column: 13,
      context: null,
    });
  });

  it('should parse Chrome error with blob URLs', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.CHROME_48_BLOB);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[1]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379',
      func: 's',
      args: [],
      line: 31,
      column: 29146,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379',
      func: 'Object.d [as add]',
      args: [],
      line: 31,
      column: 30039,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/d4eefe0f-361a-4682-b217-76587d9f712a',
      func: '?',
      args: [],
      line: 15,
      column: 10978,
      context: null,
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379',
      func: '?',
      args: [],
      line: 1,
      column: 6911,
      context: null,
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379',
      func: 'n.fire',
      args: [],
      line: 7,
      column: 3019,
      context: null,
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379',
      func: 'n.handle',
      args: [],
      line: 7,
      column: 2863,
      context: null,
    });
  });

  it('should parse empty IE 9 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.IE_9 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    if (stackFrames.stack) {
      expect(stackFrames.stack.length).toBe(0);
    }
  });

  it('should parse IE 10 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.IE_10 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    // TODO: func should be normalized
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: 'Anonymous function',
      args: [],
      line: 48,
      column: 13,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 46,
      column: 9,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 82,
      column: 1,
      context: null,
    });
  });

  it('should parse IE 11 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.IE_11);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    // TODO: func should be normalized
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: 'Anonymous function',
      args: [],
      line: 47,
      column: 21,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 45,
      column: 13,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 108,
      column: 1,
      context: null,
    });
  });

  it('should parse IE 11 eval error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.IE_11_EVAL);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'eval code',
      func: 'eval code',
      args: [],
      line: 1,
      column: 1,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 58,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 109,
      column: 1,
      context: null,
    });
  });

  it('should parse Opera 8.54 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_854 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 44,
      column: null,
      context: ['    this.undef();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 31,
      column: null,
      context: ['    ex = ex || this.createException();'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 18,
      column: null,
      context: ['    var p = new printStackTrace.implementation(), result = p.run(ex);'],
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 4,
      column: null,
      context: ['    printTrace(printStackTrace());'],
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 7,
      column: null,
      context: ['    bar(n - 1);'],
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 11,
      column: null,
      context: ['    bar(2);'],
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 15,
      column: null,
      context: ['    foo();'],
    });
  });

  it('should parse Opera 9.02 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_902 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 44,
      column: null,
      context: ['    this.undef();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 31,
      column: null,
      context: ['    ex = ex || this.createException();'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 18,
      column: null,
      context: ['    var p = new printStackTrace.implementation(), result = p.run(ex);'],
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 4,
      column: null,
      context: ['    printTrace(printStackTrace());'],
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 7,
      column: null,
      context: ['    bar(n - 1);'],
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 11,
      column: null,
      context: ['    bar(2);'],
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 15,
      column: null,
      context: ['    foo();'],
    });
  });

  it('should parse Opera 9.27 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_927 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 43,
      column: null,
      context: ['    bar(n - 1);'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 31,
      column: null,
      context: ['    bar(2);'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 18,
      column: null,
      context: ['    foo();'],
    });
  });

  it('should parse Opera 9.64 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_964 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(6);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 27,
      column: null,
      context: ['            ex = ex || this.createException();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'printStackTrace',
      args: [],
      line: 18,
      column: null,
      context: ['        var p = new printStackTrace.implementation(), result = p.run(ex);'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 4,
      column: null,
      context: ['             printTrace(printStackTrace());'],
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 7,
      column: null,
      context: ['           bar(n - 1);'],
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 11,
      column: null,
      context: ['           bar(2);'],
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 15,
      column: null,
      context: ['         foo();'],
    });
  });

  it('should parse Opera 10 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_10 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 42,
      column: null,
      context: ['                this.undef();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 27,
      column: null,
      context: ['            ex = ex || this.createException();'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'printStackTrace',
      args: [],
      line: 18,
      column: null,
      context: ['        var p = new printStackTrace.implementation(), result = p.run(ex);'],
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 4,
      column: null,
      context: ['             printTrace(printStackTrace());'],
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 7,
      column: null,
      context: ['           bar(n - 1);'],
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 11,
      column: null,
      context: ['           bar(2);'],
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 15,
      column: null,
      context: ['         foo();'],
    });
  });

  it('should parse Opera 11 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_11 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(7);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: 'createException',
      args: [],
      line: 42,
      column: 12,
      context: ['    this.undef();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'run',
      args: ['ex'],
      line: 27,
      column: 8,
      context: ['    ex = ex || this.createException();'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'printStackTrace',
      args: ['options'],
      line: 18,
      column: 4,
      context: ['    var p = new printStackTrace.implementation(), result = p.run(ex);'],
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: ['n'],
      line: 4,
      column: 5,
      context: ['    printTrace(printStackTrace());'],
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: ['n'],
      line: 7,
      column: 4,
      context: ['    bar(n - 1);'],
    });
    expect(stackFrames.stack[5]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 11,
      column: 4,
      context: ['    bar(2);'],
    });
    expect(stackFrames.stack[6]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 15,
      column: 3,
      context: ['    foo();'],
    });
  });

  it('should parse Opera 12 error', () => {
    // TODO: Improve anonymous function name.
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.OPERA_12 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://localhost:8000/ExceptionLab.html',
      func: '<anonymous function>',
      args: ['x'],
      line: 48,
      column: 12,
      context: ['    x.undef();'],
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://localhost:8000/ExceptionLab.html',
      func: 'dumpException3',
      args: [],
      line: 46,
      column: 8,
      context: ['    dumpException((function(x) {'],
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://localhost:8000/ExceptionLab.html',
      func: '<anonymous function>',
      args: ['event'],
      line: 1,
      column: 0,
      context: ['    dumpException3();'],
    });
  });

  it('should parse Opera 25 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.OPERA_25);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 47,
      column: 22,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 52,
      column: 15,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: 'bar',
      args: [],
      line: 108,
      column: 168,
      context: null,
    });
  });

  it('should parse PhantomJS 1.19 error', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.PHANTOMJS_1_19 as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'file:///path/to/file.js',
      func: '?',
      args: [],
      line: 878,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://path/to/file.js',
      func: 'foo',
      args: [],
      line: 4283,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://path/to/file.js',
      func: '?',
      args: [],
      line: 4287,
      column: null,
      context: null,
    });
  });

  it('should parse Firefox errors with resource: URLs', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.FIREFOX_50_RESOURCE_URL);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(3);
    expect(stackFrames.stack[0]).toEqual({
      url: 'resource://path/data/content/bundle.js',
      func: 'render',
      args: [],
      line: 5529,
      column: 16,
      context: null,
    });
  });

  it('should parse Firefox errors with eval URLs', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.FIREFOX_43_EVAL as unknown as Error,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(5);
    expect(stackFrames.stack[0]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'baz',
      args: [],
      line: 26,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[1]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'foo',
      args: [],
      line: 26,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[2]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: '?',
      args: [],
      line: 26,
      column: null,
      context: null,
    });
    expect(stackFrames.stack[3]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: 'speak',
      args: [],
      line: 26,
      column: 17,
      context: null,
    });
    expect(stackFrames.stack[4]).toEqual({
      url: 'http://localhost:8080/file.js',
      func: '?',
      args: [],
      line: 33,
      column: 9,
      context: null,
    });
  });

  it('should parse React Native errors on Android', () => {
    const stackFrames = getTraceKit().computeStackTrace(CapturedExceptions.ANDROID_REACT_NATIVE);
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(8);
    expect(stackFrames.stack[0]).toEqual({
      url: '/home/username/sample-workspace/sampleapp.collect.react/src/components/GpsMonitorScene.js',
      func: 'render',
      args: [],
      line: 78,
      column: 24,
      context: null,
    });
    expect(stackFrames.stack[7]).toEqual({
      url: '/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/native/ReactNativeBaseComponent.js',
      func: 'this',
      args: [],
      line: 74,
      column: 41,
      context: null,
    });
  });

  it('should parse React Native errors on Android Production', () => {
    const stackFrames = getTraceKit().computeStackTrace(
      CapturedExceptions.ANDROID_REACT_NATIVE_PROD,
    );
    expect(stackFrames).toBeTruthy();
    expect(stackFrames.stack.length).toBe(37);
    expect(stackFrames.stack[0]).toEqual({
      url: 'index.android.bundle',
      func: 'value',
      args: [],
      line: 12,
      column: 1917,
      context: null,
    });
    expect(stackFrames.stack[35]).toEqual({
      url: 'index.android.bundle',
      func: 'value',
      args: [],
      line: 29,
      column: 927,
      context: null,
    });
    expect(stackFrames.stack[36]).toEqual({
      url: '[native code]',
      func: '?',
      args: [],
      line: null,
      column: null,
      context: null,
    });
  });
});
