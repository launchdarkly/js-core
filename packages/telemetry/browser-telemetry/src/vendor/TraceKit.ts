/**
 * https://github.com/csnover/TraceKit
 * @license MIT
 * @namespace TraceKit
 */

/**
 * This file has been vendored to make it compatible with ESM and to any potential window
 * level TraceKit instance.
 *
 * Functionality unused by this SDK has been removed to minimize size.
 *
 * It has additionally been converted to typescript.
 */

/**
 * Currently the conversion to typescript is minimal, so the following eslint
 * rules are disabled.
 */

/* eslint-disable func-names */
/* eslint-disable no-shadow-restricted-names */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
/* eslint-disable no-cond-assign */
/* eslint-disable consistent-return */
/* eslint-disable no-empty */
/* eslint-disable no-plusplus */
/* eslint-disable prefer-rest-params */
/* eslint-disable no-useless-escape */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
/* eslint-disable no-underscore-dangle */

export interface TraceKitStatic {
  computeStackTrace: {
    (ex: Error, depth?: number): StackTrace;
    augmentStackTraceWithInitialElement: (
      stackInfo: StackTrace,
      url: string,
      lineNo: number | string,
      message: string,
    ) => boolean;
    computeStackTraceFromStackProp: (ex: Error) => StackTrace | null;
    guessFunctionName: (url: string, lineNo: number | string) => string;
    gatherContext: (url: string, line: number | string) => string[] | null;
    ofCaller: (depth?: number) => StackTrace;
    getSource: (url: string) => string[];
  };
  remoteFetching: boolean;
  collectWindowErrors: boolean;
  linesOfContext: number;
  debug: boolean;
}

const TraceKit: any = {};

export interface StackFrame {
  url: string;
  func: string;
  args?: string[];
  line?: number;
  column?: number;
  context?: string[];
}

export type Mode = 'stack' | 'stacktrace' | 'multiline' | 'callers' | 'onerror' | 'failed';

export interface StackTrace {
  name: string;
  message: string;
  stack: StackFrame[];
  mode: Mode;
  incomplete?: boolean;
  partial?: boolean;
}

(function (window, undefined) {
  if (!window) {
    return;
  }

  // global reference to slice
  const _slice = [].slice;
  const UNKNOWN_FUNCTION = '?';

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
  const ERROR_TYPES_RE =
    /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;

  /**
   * A better form of hasOwnProperty<br/>
   * Example: `_has(MainHostObject, property) === true/false`
   *
   * @param {Object} object to check property
   * @param {string} key to check
   * @return {Boolean} true if the object has the key and it is not inherited
   */
  function _has(object: any, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  /**
   * Returns true if the parameter is undefined<br/>
   * Example: `_isUndefined(val) === true/false`
   *
   * @param {*} what Value to check
   * @return {Boolean} true if undefined and false otherwise
   */
  function _isUndefined(what: any): boolean {
    return typeof what === 'undefined';
  }

  /**
   * Wrap any function in a TraceKit reporter<br/>
   * Example: `func = TraceKit.wrap(func);`
   *
   * @param {Function} func Function to be wrapped
   * @return {Function} The wrapped func
   * @memberof TraceKit
   */
  TraceKit.wrap = function traceKitWrapper(func: Function): Function {
    function wrapped(this: any) {
      try {
        return func.apply(this, arguments);
      } catch (e) {
        TraceKit.report(e);
        throw e;
      }
    }
    return wrapped;
  };

  /**
   * TraceKit.computeStackTrace: cross-browser stack traces in JavaScript
   *
   * Syntax:
   *   ```js
   *   s = TraceKit.computeStackTrace.ofCaller([depth])
   *   s = TraceKit.computeStackTrace(exception) // consider using TraceKit.report instead (see below)
   *   ```
   *
   * Supports:
   *   - Firefox:  full stack trace with line numbers and unreliable column
   *               number on top frame
   *   - Opera 10: full stack trace with line and column numbers
   *   - Opera 9-: full stack trace with line numbers
   *   - Chrome:   full stack trace with line and column numbers
   *   - Safari:   line and column number for the topmost stacktrace element
   *               only
   *   - IE:       no line numbers whatsoever
   *
   * Tries to guess names of anonymous functions by looking for assignments
   * in the source code. In IE and Safari, we have to guess source file names
   * by searching for function bodies inside all page scripts. This will not
   * work for scripts that are loaded cross-domain.
   * Here be dragons: some function names may be guessed incorrectly, and
   * duplicate functions may be mismatched.
   *
   * TraceKit.computeStackTrace should only be used for tracing purposes.
   * Logging of unhandled exceptions should be done with TraceKit.report,
   * which builds on top of TraceKit.computeStackTrace and provides better
   * IE support by utilizing the window.onerror event to retrieve information
   * about the top of the stack.
   *
   * Note: In IE and Safari, no stack trace is recorded on the Error object,
   * so computeStackTrace instead walks its *own* chain of callers.
   * This means that:
   *  * in Safari, some methods may be missing from the stack trace;
   *  * in IE, the topmost function in the stack trace will always be the
   *    caller of computeStackTrace.
   *
   * This is okay for tracing (because you are likely to be calling
   * computeStackTrace from the function you want to be the topmost element
   * of the stack trace anyway), but not okay for logging unhandled
   * exceptions (because your catch block will likely be far away from the
   * inner function that actually caused the exception).
   *
   * Tracing example:
   *  ```js
   *     function trace(message) {
   *         var stackInfo = TraceKit.computeStackTrace.ofCaller();
   *         var data = message + "\n";
   *         for(var i in stackInfo.stack) {
   *             var item = stackInfo.stack[i];
   *             data += (item.func || '[anonymous]') + "() in " + item.url + ":" + (item.line || '0') + "\n";
   *         }
   *         if (window.console)
   *             console.info(data);
   *         else
   *             alert(data);
   *     }
   * ```
   * @memberof TraceKit
   * @namespace
   */
  TraceKit.computeStackTrace = (function computeStackTraceWrapper() {
    const debug = false;
    const sourceCache: Record<string, string[]> = {};

    /**
     * Attempts to retrieve source code via XMLHttpRequest, which is used
     * to look up anonymous function names.
     * @param {string} url URL of source code.
     * @return {string} Source contents.
     * @memberof TraceKit.computeStackTrace
     */
    function loadSource(url: string): string {
      if (!TraceKit.remoteFetching) {
        // Only attempt request if remoteFetching is on.
        return '';
      }
      try {
        const getXHR = function () {
          try {
            return new window.XMLHttpRequest();
          } catch (e) {
            // explicitly bubble up the exception if not found
            // @ts-ignore
            return new window.ActiveXObject('Microsoft.XMLHTTP');
          }
        };

        const request = getXHR();
        request.open('GET', url, false);
        request.send('');
        return request.responseText;
      } catch (e) {
        return '';
      }
    }

    /**
     * Retrieves source code from the source code cache.
     * @param {string} url URL of source code.
     * @return {Array.<string>} Source contents.
     * @memberof TraceKit.computeStackTrace
     */
    function getSource(url: string): string[] {
      if (typeof url !== 'string') {
        return [];
      }

      if (!_has(sourceCache, url)) {
        // URL needs to be able to fetched within the acceptable domain.  Otherwise,
        // cross-domain errors will be triggered.
        /*
                    Regex matches:
                    0 - Full Url
                    1 - Protocol
                    2 - Domain
                    3 - Port (Useful for internal applications)
                    4 - Path
                */
        let source = '';
        let domain = '';
        try {
          domain = window.document.domain;
        } catch (e) {}
        const match = /(.*)\:\/\/([^:\/]+)([:\d]*)\/{0,1}([\s\S]*)/.exec(url);
        if (match && match[2] === domain) {
          source = loadSource(url);
        }
        sourceCache[url] = source ? source.split('\n') : [];
      }

      return sourceCache[url];
    }

    /**
     * Tries to use an externally loaded copy of source code to determine
     * the name of a function by looking at the name of the variable it was
     * assigned to, if any.
     * @param {string} url URL of source code.
     * @param {(string|number)} lineNo Line number in source code.
     * @return {string} The function name, if discoverable.
     * @memberof TraceKit.computeStackTrace
     */
    function guessFunctionName(url: string, lineNo: string | number) {
      if (typeof lineNo !== 'number') {
        lineNo = Number(lineNo);
      }
      const reFunctionArgNames = /function ([^(]*)\(([^)]*)\)/;
      const reGuessFunction = /['"]?([0-9A-Za-z$_]+)['"]?\s*[:=]\s*(function|eval|new Function)/;
      let line = '';
      const maxLines = 10;
      const source = getSource(url);
      let m;

      if (!source.length) {
        return UNKNOWN_FUNCTION;
      }

      // Walk backwards from the first line in the function until we find the line which
      // matches the pattern above, which is the function definition
      for (let i = 0; i < maxLines; ++i) {
        line = source[lineNo - i] + line;

        if (!_isUndefined(line)) {
          if ((m = reGuessFunction.exec(line))) {
            return m[1];
          }
          if ((m = reFunctionArgNames.exec(line))) {
            return m[1];
          }
        }
      }

      return UNKNOWN_FUNCTION;
    }

    /**
     * Retrieves the surrounding lines from where an exception occurred.
     * @param {string} url URL of source code.
     * @param {(string|number)} line Line number in source code to center around for context.
     * @return {?Array.<string>} Lines of source code.
     * @memberof TraceKit.computeStackTrace
     */
    function gatherContext(url: string, line: string | number): string[] | null {
      if (typeof line !== 'number') {
        line = Number(line);
      }
      const source = getSource(url);

      if (!source.length) {
        return null;
      }

      const context = [];
      // linesBefore & linesAfter are inclusive with the offending line.
      // if linesOfContext is even, there will be one extra line
      //   *before* the offending line.
      const linesBefore = Math.floor(TraceKit.linesOfContext / 2);
      // Add one extra line if linesOfContext is odd
      const linesAfter = linesBefore + (TraceKit.linesOfContext % 2);
      const start = Math.max(0, line - linesBefore - 1);
      const end = Math.min(source.length, line + linesAfter - 1);

      line -= 1; // convert to 0-based index

      for (let i = start; i < end; ++i) {
        if (!_isUndefined(source[i])) {
          context.push(source[i]);
        }
      }

      return context.length > 0 ? context : null;
    }

    /**
     * Escapes special characters, except for whitespace, in a string to be
     * used inside a regular expression as a string literal.
     * @param {string} text The string.
     * @return {string} The escaped string literal.
     * @memberof TraceKit.computeStackTrace
     */
    function escapeRegExp(text: string): string {
      return text.replace(/[\-\[\]{}()*+?.,\\\^$|#]/g, '\\$&');
    }

    /**
     * Escapes special characters in a string to be used inside a regular
     * expression as a string literal. Also ensures that HTML entities will
     * be matched the same as their literal friends.
     * @param {string} body The string.
     * @return {string} The escaped string.
     * @memberof TraceKit.computeStackTrace
     */
    function escapeCodeAsRegExpForMatchingInsideHTML(body: string): string {
      return escapeRegExp(body)
        .replace('<', '(?:<|&lt;)')
        .replace('>', '(?:>|&gt;)')
        .replace('&', '(?:&|&amp;)')
        .replace('"', '(?:"|&quot;)')
        .replace(/\s+/g, '\\s+');
    }

    /**
     * Determines where a code fragment occurs in the source code.
     * @param {RegExp} re The function definition.
     * @param {Array.<string>} urls A list of URLs to search.
     * @return {?Object.<string, (string|number)>} An object containing
     * the url, line, and column number of the defined function.
     * @memberof TraceKit.computeStackTrace
     */
    function findSourceInUrls(
      re: RegExp,
      urls: string[],
    ): {
      url: string;
      line: number;
      column: number;
    } | null {
      let source: any;
      let m: any;
      for (let i = 0, j = urls.length; i < j; ++i) {
        if ((source = getSource(urls[i])).length) {
          source = source.join('\n');
          if ((m = re.exec(source))) {
            return {
              url: urls[i],
              line: source.substring(0, m.index).split('\n').length,
              column: m.index - source.lastIndexOf('\n', m.index) - 1,
            };
          }
        }
      }

      return null;
    }

    /**
     * Determines at which column a code fragment occurs on a line of the
     * source code.
     * @param {string} fragment The code fragment.
     * @param {string} url The URL to search.
     * @param {(string|number)} line The line number to examine.
     * @return {?number} The column number.
     * @memberof TraceKit.computeStackTrace
     */
    function findSourceInLine(fragment: string, url: string, line: string | number): number | null {
      if (typeof line !== 'number') {
        line = Number(line);
      }
      const source = getSource(url);
      const re = new RegExp(`\\b${escapeRegExp(fragment)}\\b`);
      let m: any;

      line -= 1;

      if (source && source.length > line && (m = re.exec(source[line]))) {
        return m.index;
      }

      return null;
    }

    /**
     * Determines where a function was defined within the source code.
     * @param {(Function|string)} func A function reference or serialized
     * function definition.
     * @return {?Object.<string, (string|number)>} An object containing
     * the url, line, and column number of the defined function.
     * @memberof TraceKit.computeStackTrace
     */
    function findSourceByFunctionBody(func: Function | string) {
      if (_isUndefined(window && window.document)) {
        return;
      }

      const urls = [window.location.href];
      const scripts = window.document.getElementsByTagName('script');
      let body;
      const code = `${func}`;
      const codeRE = /^function(?:\s+([\w$]+))?\s*\(([\w\s,]*)\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/;
      const eventRE = /^function on([\w$]+)\s*\(event\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/;
      let re;
      let parts;
      let result;

      for (let i = 0; i < scripts.length; ++i) {
        const script = scripts[i];
        if (script.src) {
          urls.push(script.src);
        }
      }

      if (!(parts = codeRE.exec(code))) {
        re = new RegExp(escapeRegExp(code).replace(/\s+/g, '\\s+'));
      }

      // not sure if this is really necessary, but I don’t have a test
      // corpus large enough to confirm that and it was in the original.
      else {
        const name = parts[1] ? `\\s+${parts[1]}` : '';
        const args = parts[2].split(',').join('\\s*,\\s*');

        body = escapeRegExp(parts[3]).replace(/;$/, ';?'); // semicolon is inserted if the function ends with a comment.replace(/\s+/g, '\\s+');
        re = new RegExp(`function${name}\\s*\\(\\s*${args}\\s*\\)\\s*{\\s*${body}\\s*}`);
      }

      // look for a normal function definition
      if ((result = findSourceInUrls(re, urls))) {
        return result;
      }

      // look for an old-school event handler function
      if ((parts = eventRE.exec(code))) {
        const event = parts[1];
        body = escapeCodeAsRegExpForMatchingInsideHTML(parts[2]);

        // look for a function defined in HTML as an onXXX handler
        re = new RegExp(`on${event}=[\\'"]\\s*${body}\\s*[\\'"]`, 'i');

        // The below line is as it appears in the original code.
        // @ts-expect-error TODO (SDK-1037): Determine if this is a bug or handling for some unexpected case.
        if ((result = findSourceInUrls(re, urls[0]))) {
          return result;
        }

        // look for ???
        re = new RegExp(body);

        if ((result = findSourceInUrls(re, urls))) {
          return result;
        }
      }

      return null;
    }

    // Contents of Exception in various browsers.
    //
    // SAFARI:
    // ex.message = Can't find variable: qq
    // ex.line = 59
    // ex.sourceId = 580238192
    // ex.sourceURL = http://...
    // ex.expressionBeginOffset = 96
    // ex.expressionCaretOffset = 98
    // ex.expressionEndOffset = 98
    // ex.name = ReferenceError
    //
    // FIREFOX:
    // ex.message = qq is not defined
    // ex.fileName = http://...
    // ex.lineNumber = 59
    // ex.columnNumber = 69
    // ex.stack = ...stack trace... (see the example below)
    // ex.name = ReferenceError
    //
    // CHROME:
    // ex.message = qq is not defined
    // ex.name = ReferenceError
    // ex.type = not_defined
    // ex.arguments = ['aa']
    // ex.stack = ...stack trace...
    //
    // INTERNET EXPLORER:
    // ex.message = ...
    // ex.name = ReferenceError
    //
    // OPERA:
    // ex.message = ...message... (see the example below)
    // ex.name = ReferenceError
    // ex.opera#sourceloc = 11  (pretty much useless, duplicates the info in ex.message)
    // ex.stacktrace = n/a; see 'opera:config#UserPrefs|Exceptions Have Stacktrace'

    /**
     * Computes stack trace information from the stack property.
     * Chrome and Gecko use this property.
     * @param {Error} ex
     * @return {?TraceKit.StackTrace} Stack trace information.
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTraceFromStackProp(ex: any): StackTrace | null {
      if (!ex.stack) {
        return null;
      }

      const chrome =
        /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
      const gecko =
        /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
      const winjs =
        /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;

      // Used to additionally parse URL/line/column from eval frames
      let isEval;
      const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
      const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;

      const lines = ex.stack.split('\n');
      const stack: any = [];
      let submatch: any;
      let parts: any;
      let element: any;
      const reference: any = /^(.*) is undefined$/.exec(ex.message);

      for (let i = 0, j = lines.length; i < j; ++i) {
        if ((parts = chrome.exec(lines[i]))) {
          const isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
          isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
          if (isEval && (submatch = chromeEval.exec(parts[2]))) {
            // throw out eval line/column and use top-most line/column number
            parts[2] = submatch[1]; // url
            parts[3] = submatch[2]; // line
            parts[4] = submatch[3]; // column
          }
          element = {
            url: !isNative ? parts[2] : null,
            func: parts[1] || UNKNOWN_FUNCTION,
            args: isNative ? [parts[2]] : [],
            line: parts[3] ? +parts[3] : null,
            column: parts[4] ? +parts[4] : null,
          };
        } else if ((parts = winjs.exec(lines[i]))) {
          element = {
            url: parts[2],
            func: parts[1] || UNKNOWN_FUNCTION,
            args: [],
            line: +parts[3],
            column: parts[4] ? +parts[4] : null,
          };
        } else if ((parts = gecko.exec(lines[i]))) {
          isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
          if (isEval && (submatch = geckoEval.exec(parts[3]))) {
            // throw out eval line/column and use top-most line number
            parts[3] = submatch[1];
            parts[4] = submatch[2];
            parts[5] = null; // no column when eval
          } else if (i === 0 && !parts[5] && !_isUndefined(ex.columnNumber)) {
            // FireFox uses this awesome columnNumber property for its top frame
            // Also note, Firefox's column number is 0-based and everything else expects 1-based,
            // so adding 1
            // NOTE: this hack doesn't work if top-most frame is eval
            stack[0].column = ex.columnNumber + 1;
          }
          element = {
            url: parts[3],
            func: parts[1] || UNKNOWN_FUNCTION,
            args: parts[2] ? parts[2].split(',') : [],
            line: parts[4] ? +parts[4] : null,
            column: parts[5] ? +parts[5] : null,
          };
        } else {
          continue;
        }

        if (!element.func && element.line) {
          element.func = guessFunctionName(element.url, element.line);
        }

        element.context = element.line ? gatherContext(element.url, element.line) : null;
        stack.push(element);
      }

      if (!stack.length) {
        return null;
      }

      if (stack[0] && stack[0].line && !stack[0].column && reference) {
        stack[0].column = findSourceInLine(reference[1], stack[0].url, stack[0].line);
      }

      return {
        mode: 'stack',
        name: ex.name,
        message: ex.message,
        stack,
      };
    }

    /**
     * Computes stack trace information from the stacktrace property.
     * Opera 10+ uses this property.
     * @param {Error} ex
     * @return {?TraceKit.StackTrace} Stack trace information.
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTraceFromStacktraceProp(ex: any): StackTrace | null {
      // Access and store the stacktrace property before doing ANYTHING
      // else to it because Opera is not very good at providing it
      // reliably in other circumstances.
      const { stacktrace } = ex;
      if (!stacktrace) {
        return null;
      }

      const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
      const opera11Regex =
        / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^\)]+))\((.*)\))? in (.*):\s*$/i;
      const lines = stacktrace.split('\n');
      const stack = [];
      let parts;

      for (let line = 0; line < lines.length; line += 2) {
        let element: any = null;
        if ((parts = opera10Regex.exec(lines[line]))) {
          element = {
            url: parts[2],
            line: +parts[1],
            column: null,
            func: parts[3],
            args: [],
          };
        } else if ((parts = opera11Regex.exec(lines[line]))) {
          element = {
            url: parts[6],
            line: +parts[1],
            column: +parts[2],
            func: parts[3] || parts[4],
            args: parts[5] ? parts[5].split(',') : [],
          };
        }

        if (element) {
          if (!element.func && element.line) {
            element.func = guessFunctionName(element.url, element.line);
          }
          if (element.line) {
            try {
              element.context = gatherContext(element.url, element.line);
            } catch (exc) {}
          }

          if (!element.context) {
            element.context = [lines[line + 1]];
          }

          stack.push(element);
        }
      }

      if (!stack.length) {
        return null;
      }

      return {
        mode: 'stacktrace',
        name: ex.name,
        message: ex.message,
        stack,
      };
    }

    /**
     * NOT TESTED.
     * Computes stack trace information from an error message that includes
     * the stack trace.
     * Opera 9 and earlier use this method if the option to show stack
     * traces is turned on in opera:config.
     * @param {Error} ex
     * @return {?TraceKit.StackTrace} Stack information.
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTraceFromOperaMultiLineMessage(ex: Error): StackTrace | null {
      // TODO: Clean this function up
      // Opera includes a stack trace into the exception message. An example is:
      //
      // Statement on line 3: Undefined variable: undefinedFunc
      // Backtrace:
      //   Line 3 of linked script file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.js: In function zzz
      //         undefinedFunc(a);
      //   Line 7 of inline#1 script in file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.html: In function yyy
      //           zzz(x, y, z);
      //   Line 3 of inline#1 script in file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.html: In function xxx
      //           yyy(a, a, a);
      //   Line 1 of function script
      //     try { xxx('hi'); return false; } catch(ex) { TraceKit.report(ex); }
      //   ...

      const lines = ex.message.split('\n');
      if (lines.length < 4) {
        return null;
      }

      const lineRE1 =
        /^\s*Line (\d+) of linked script ((?:file|https?|blob)\S+)(?:: in function (\S+))?\s*$/i;
      const lineRE2 =
        /^\s*Line (\d+) of inline#(\d+) script in ((?:file|https?|blob)\S+)(?:: in function (\S+))?\s*$/i;
      const lineRE3 = /^\s*Line (\d+) of function script\s*$/i;
      const stack = [];
      const scripts = window && window.document && window.document.getElementsByTagName('script');
      const inlineScriptBlocks = [];
      let parts: any;

      for (const s in scripts) {
        if (_has(scripts, s) && !scripts[s].src) {
          inlineScriptBlocks.push(scripts[s]);
        }
      }

      for (let line = 2; line < lines.length; line += 2) {
        let item: any = null;
        if ((parts = lineRE1.exec(lines[line]))) {
          item = {
            url: parts[2],
            func: parts[3],
            args: [],
            line: +parts[1],
            column: null,
          };
        } else if ((parts = lineRE2.exec(lines[line]))) {
          item = {
            url: parts[3],
            func: parts[4],
            args: [],
            line: +parts[1],
            column: null, // TODO: Check to see if inline#1 (+parts[2]) points to the script number or column number.
          };
          const relativeLine = +parts[1]; // relative to the start of the <SCRIPT> block
          const script = inlineScriptBlocks[parts[2] - 1];
          if (script) {
            let source: any = getSource(item.url);
            if (source) {
              source = source.join('\n');
              const pos = source.indexOf(script.innerText);
              if (pos >= 0) {
                item.line = relativeLine + source.substring(0, pos).split('\n').length;
              }
            }
          }
        } else if ((parts = lineRE3.exec(lines[line]))) {
          const url = window.location.href.replace(/#.*$/, '');
          const re = new RegExp(escapeCodeAsRegExpForMatchingInsideHTML(lines[line + 1]));
          const src = findSourceInUrls(re, [url]);
          item = {
            url,
            func: '',
            args: [],
            line: src ? src.line : parts[1],
            column: null,
          };
        }

        if (item) {
          if (!item.func) {
            item.func = guessFunctionName(item.url, item.line);
          }
          const context = gatherContext(item.url, item.line);
          const midline = context ? context[Math.floor(context.length / 2)] : null;
          if (
            context &&
            midline &&
            midline.replace(/^\s*/, '') === lines[line + 1].replace(/^\s*/, '')
          ) {
            item.context = context;
          } else {
            // if (context) alert("Context mismatch. Correct midline:\n" + lines[i+1] + "\n\nMidline:\n" + midline + "\n\nContext:\n" + context.join("\n") + "\n\nURL:\n" + item.url);
            item.context = [lines[line + 1]];
          }
          stack.push(item);
        }
      }
      if (!stack.length) {
        return null; // could not parse multiline exception message as Opera stack trace
      }

      return {
        mode: 'multiline',
        name: ex.name,
        message: lines[0],
        stack,
      };
    }

    /**
     * Adds information about the first frame to incomplete stack traces.
     * Safari and IE require this to get complete data on the first frame.
     * @param {TraceKit.StackTrace} stackInfo Stack trace information from
     * one of the compute* methods.
     * @param {string} url The URL of the script that caused an error.
     * @param {(number|string)} lineNo The line number of the script that
     * caused an error.
     * @param {string=} message The error generated by the browser, which
     * hopefully contains the name of the object that caused the error.
     * @return {boolean} Whether or not the stack information was
     * augmented.
     * @memberof TraceKit.computeStackTrace
     */
    function augmentStackTraceWithInitialElement(
      stackInfo: StackTrace,
      url: string,
      lineNo: number | string,
      message: string,
    ): boolean {
      const initial: any = {
        url,
        line: lineNo,
      };

      if (initial.url && initial.line) {
        stackInfo.incomplete = false;

        if (!initial.func) {
          initial.func = guessFunctionName(initial.url, initial.line);
        }

        if (!initial.context) {
          initial.context = gatherContext(initial.url, initial.line);
        }

        const reference = / '([^']+)' /.exec(message);
        if (reference) {
          initial.column = findSourceInLine(reference[1], initial.url, initial.line);
        }

        if (stackInfo.stack.length > 0) {
          if (stackInfo.stack[0].url === initial.url) {
            if (stackInfo.stack[0].line === initial.line) {
              return false; // already in stack trace
            }
            if (!stackInfo.stack[0].line && stackInfo.stack[0].func === initial.func) {
              stackInfo.stack[0].line = initial.line;
              stackInfo.stack[0].context = initial.context;
              return false;
            }
          }
        }

        stackInfo.stack.unshift(initial);
        stackInfo.partial = true;
        return true;
      }
      stackInfo.incomplete = true;

      return false;
    }

    /**
     * Computes stack trace information by walking the arguments.caller
     * chain at the time the exception occurred. This will cause earlier
     * frames to be missed but is the only way to get any stack trace in
     * Safari and IE. The top frame is restored by
     * {@link augmentStackTraceWithInitialElement}.
     * @param {Error} ex
     * @return {TraceKit.StackTrace=} Stack trace information.
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTraceByWalkingCallerChain(ex: any, depth: number) {
      const functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;
      const stack = [];
      const funcs = {};
      let recursion = false;
      let parts: any;
      let item: any;
      let source;

      for (
        let curr = computeStackTraceByWalkingCallerChain.caller;
        curr && !recursion;
        curr = curr.caller
      ) {
        if (curr === computeStackTrace || curr === TraceKit.report) {
          continue;
        }

        item = {
          url: null,
          func: UNKNOWN_FUNCTION,
          args: [],
          line: null,
          column: null,
        };

        if (curr.name) {
          item.func = curr.name;
        } else if ((parts = functionName.exec(curr.toString()))) {
          item.func = parts[1];
        }

        if (typeof item.func === 'undefined') {
          try {
            item.func = parts.input.substring(0, parts.input.indexOf('{'));
          } catch (e) {}
        }

        if ((source = findSourceByFunctionBody(curr))) {
          item.url = source.url;
          item.line = source.line;

          if (item.func === UNKNOWN_FUNCTION) {
            item.func = guessFunctionName(item.url, item.line);
          }

          const reference = / '([^']+)' /.exec(ex.message || ex.description);
          if (reference) {
            item.column = findSourceInLine(reference[1], source.url, source.line);
          }
        }

        // @ts-ignore
        if (funcs[`${curr}`]) {
          recursion = true;
        } else {
          // @ts-ignore
          funcs[`${curr}`] = true;
        }

        stack.push(item);
      }

      if (depth) {
        stack.splice(0, depth);
      }

      const result: StackTrace = {
        mode: 'callers',
        name: ex.name,
        message: ex.message,
        stack,
      };
      augmentStackTraceWithInitialElement(
        result,
        ex.sourceURL || ex.fileName,
        ex.line || ex.lineNumber,
        ex.message || ex.description,
      );
      return result;
    }

    /**
     * Computes a stack trace for an exception.
     * @param {Error} ex
     * @param {(string|number)=} depth
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTrace(ex: any, depth: number): StackTrace {
      let stack: StackTrace | null = null;
      depth = depth == null ? 0 : +depth;

      try {
        // This must be tried first because Opera 10 *destroys*
        // its stacktrace property if you try to access the stack
        // property first!!
        stack = computeStackTraceFromStacktraceProp(ex);
        if (stack) {
          return stack;
        }
      } catch (e) {
        if (debug) {
          throw e;
        }
      }

      try {
        stack = computeStackTraceFromStackProp(ex);
        if (stack) {
          return stack;
        }
      } catch (e) {
        if (debug) {
          throw e;
        }
      }

      try {
        stack = computeStackTraceFromOperaMultiLineMessage(ex);
        if (stack) {
          return stack;
        }
      } catch (e) {
        if (debug) {
          throw e;
        }
      }

      try {
        stack = computeStackTraceByWalkingCallerChain(ex, depth + 1);
        if (stack) {
          return stack;
        }
      } catch (e) {
        if (debug) {
          throw e;
        }
      }

      return {
        name: ex.name,
        message: ex.message,
        mode: 'failed',
        stack: [],
      };
    }

    /**
     * Logs a stacktrace starting from the previous call and working down.
     * @param {(number|string)=} depth How many frames deep to trace.
     * @return {TraceKit.StackTrace} Stack trace information.
     * @memberof TraceKit.computeStackTrace
     */
    function computeStackTraceOfCaller(depth: number): StackTrace {
      depth = (depth == null ? 0 : +depth) + 1; // "+ 1" because "ofCaller" should drop one frame
      try {
        throw new Error();
      } catch (ex) {
        return computeStackTrace(ex, depth + 1);
      }
    }

    computeStackTrace.augmentStackTraceWithInitialElement = augmentStackTraceWithInitialElement;
    computeStackTrace.computeStackTraceFromStackProp = computeStackTraceFromStackProp;
    computeStackTrace.guessFunctionName = guessFunctionName;
    computeStackTrace.gatherContext = gatherContext;
    computeStackTrace.ofCaller = computeStackTraceOfCaller;
    computeStackTrace.getSource = getSource;

    return computeStackTrace;
  })();

  // Default options:
  if (!TraceKit.remoteFetching) {
    TraceKit.remoteFetching = true;
  }
  if (!TraceKit.collectWindowErrors) {
    TraceKit.collectWindowErrors = true;
  }
  if (!TraceKit.linesOfContext || TraceKit.linesOfContext < 1) {
    // 5 lines before, the offending line, 5 lines after
    TraceKit.linesOfContext = 11;
  }
})(typeof window !== 'undefined' ? window : global);

export function getTraceKit(): TraceKitStatic {
  return TraceKit as TraceKitStatic;
}
