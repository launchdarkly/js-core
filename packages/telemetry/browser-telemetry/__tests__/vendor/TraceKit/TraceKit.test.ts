import { getTraceKit } from '../../../src/vendor/TraceKit';

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-var */

describe('TraceKit', function () {
  describe('General', function () {
    it('should not remove anonymous functions from the stack', function () {
      // mock up an error object with a stack trace that includes both
      // named functions and anonymous functions
      var stack_str =
        '' +
        '  Error: \n' +
        '    at new <anonymous> (http://example.com/js/test.js:63:1)\n' + // stack[0]
        '    at namedFunc0 (http://example.com/js/script.js:10:2)\n' + // stack[1]
        '    at http://example.com/js/test.js:65:10\n' + // stack[2]
        '    at namedFunc2 (http://example.com/js/script.js:20:5)\n' + // stack[3]
        '    at http://example.com/js/test.js:67:5\n' + // stack[4]
        '    at namedFunc4 (http://example.com/js/script.js:100001:10002)'; // stack[5]
      var mock_err = { stack: stack_str };
      var stackFrames = getTraceKit().computeStackTrace.computeStackTraceFromStackProp(
        mock_err as unknown as Error,
      );

      // Make sure TraceKit didn't remove the anonymous functions
      // from the stack like it used to :)
      expect(stackFrames).toBeTruthy();
      expect(stackFrames?.stack[0].func).toEqual('new <anonymous>');
      expect(stackFrames?.stack[0].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[0].line).toBe(63);
      expect(stackFrames?.stack[0].column).toBe(1);

      expect(stackFrames?.stack[1].func).toEqual('namedFunc0');
      expect(stackFrames?.stack[1].url).toEqual('http://example.com/js/script.js');
      expect(stackFrames?.stack[1].line).toBe(10);
      expect(stackFrames?.stack[1].column).toBe(2);

      expect(stackFrames?.stack[2].func).toEqual('?');
      expect(stackFrames?.stack[2].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[2].line).toBe(65);
      expect(stackFrames?.stack[2].column).toBe(10);

      expect(stackFrames?.stack[3].func).toEqual('namedFunc2');
      expect(stackFrames?.stack[3].url).toEqual('http://example.com/js/script.js');
      expect(stackFrames?.stack[3].line).toBe(20);
      expect(stackFrames?.stack[3].column).toBe(5);

      expect(stackFrames?.stack[4].func).toEqual('?');
      expect(stackFrames?.stack[4].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[4].line).toBe(67);
      expect(stackFrames?.stack[4].column).toBe(5);

      expect(stackFrames?.stack[5].func).toEqual('namedFunc4');
      expect(stackFrames?.stack[5].url).toEqual('http://example.com/js/script.js');
      expect(stackFrames?.stack[5].line).toBe(100001);
      expect(stackFrames?.stack[5].column).toBe(10002);
    });

    it('should handle eval/anonymous strings in Chrome 46', function () {
      var stack_str =
        '' +
        'ReferenceError: baz is not defined\n' +
        '   at bar (http://example.com/js/test.js:19:7)\n' +
        '   at foo (http://example.com/js/test.js:23:7)\n' +
        '   at eval (eval at <anonymous> (http://example.com/js/test.js:26:5)).toBe(<anonymous>:1:26)\n';

      var mock_err = { stack: stack_str };
      var stackFrames = getTraceKit().computeStackTrace.computeStackTraceFromStackProp(
        mock_err as unknown as Error,
      );
      expect(stackFrames).toBeTruthy();
      expect(stackFrames?.stack[0].func).toEqual('bar');
      expect(stackFrames?.stack[0].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[0].line).toBe(19);
      expect(stackFrames?.stack[0].column).toBe(7);

      expect(stackFrames?.stack[1].func).toEqual('foo');
      expect(stackFrames?.stack[1].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[1].line).toBe(23);
      expect(stackFrames?.stack[1].column).toBe(7);

      expect(stackFrames?.stack[2].func).toEqual('eval');
      // TODO: fix nested evals
      expect(stackFrames?.stack[2].url).toEqual('http://example.com/js/test.js');
      expect(stackFrames?.stack[2].line).toBe(26);
      expect(stackFrames?.stack[2].column).toBe(5);
    });
  });

  describe('.computeStackTrace', function () {
    it('should handle a native error object', function () {
      var ex = new Error('test');
      var stack = getTraceKit().computeStackTrace(ex);
      expect(stack.name).toEqual('Error');
      expect(stack.message).toEqual('test');
    });

    it('should handle a native error object stack from Chrome', function () {
      var stackStr =
        '' +
        'Error: foo\n' +
        '    at <anonymous>:2:11\n' +
        '    at Object.InjectedScript._evaluateOn (<anonymous>:904:140)\n' +
        '    at Object.InjectedScript._evaluateAndWrap (<anonymous>:837:34)\n' +
        '    at Object.InjectedScript.evaluate (<anonymous>:693:21)';
      var mockErr = {
        name: 'Error',
        message: 'foo',
        stack: stackStr,
      };
      var stackFrames = getTraceKit().computeStackTrace(mockErr);
      expect(stackFrames).toBeTruthy();
      expect(stackFrames.stack[0].url).toEqual('<anonymous>');
    });
  });
});
