import { HttpBreadcrumb } from '../../api/Breadcrumb';

const LD_ORIGINAL_XHR = '__LaunchDarkly_original_xhr';
const LD_ORIGINAL_XHR_OPEN = `${LD_ORIGINAL_XHR}_open`;
const LD_ORIGINAL_XHR_SEND = `${LD_ORIGINAL_XHR}_send`;

// Key used to store data inside the xhr.
const LD_DATA_XHR = '__LaunchDarkly_data_xhr';

// We want to monitor open to collect the URL and method.
const originalOpen = window.XMLHttpRequest.prototype.open;
// We want to monitor send in order to generate an accurate timestamp.
const originalSend = window.XMLHttpRequest.prototype.send;

interface LDXhrData {
  method?: string;
  url?: string;
  timestamp?: number;
  error?: boolean;
}

/**
 * Decorate XMLHttpRequest and execute the callback whenever a request is completed.
 *
 * @param callback Function which handles a breadcrumb.
 */
export default function decorateXhr(callback: (breadcrumb: HttpBreadcrumb) => void) {
  // In these functions we add type annotations for `this`. The impact here should just
  // be that we get correct typing for typescript. They should not affect the output.

  // We are using functions instead of an arrow functions in order to preserve the original `this`.
  // Arrow functions capture the enclosing `this`.

  function wrappedOpen(this: XMLHttpRequest, ...args: any[]) {
    // Listen to error so we can tag this request as having an error. If there is no error event
    // then the request will assume to not have errored.
    // eslint-disable-next-line func-names
    this.addEventListener('error', function (_event: ProgressEvent<XMLHttpRequestEventTarget>) {
      // We know, if the data is present, that it has this shape, as we injected it.
      const data: LDXhrData = (this as any)[LD_DATA_XHR];
      data.error = true;
    });

    this.addEventListener(
      'loadend',
      // eslint-disable-next-line func-names
      function (_event: ProgressEvent<XMLHttpRequestEventTarget>) {
        // We know, if the data is present, that it has this shape, as we injected it.
        const data: LDXhrData = (this as any)[LD_DATA_XHR];
        // Timestamp could be falsy for 0, but obviously that isn't a good timestamp, so we are ok.
        if (data && data.timestamp) {
          callback({
            class: 'http',
            timestamp: data.timestamp,
            level: data.error ? 'error' : 'info',
            type: 'xhr',
            data: {
              url: data.url,
              method: data.method,
              statusCode: this.status,
              statusText: this.statusText,
            },
          });
        }
      },
      true,
    );

    // We know these will be open arguments.
    originalOpen.apply(this, args as any);

    try {
      const xhrData: LDXhrData = {
        method: args?.[0],
        url: args?.[1],
      };
      // Use defineProperty to prevent this value from being enumerable.
      Object.defineProperty(this, LD_DATA_XHR, {
        // Defaults to non-enumerable.
        value: xhrData,
        writable: true,
        configurable: true,
      });
    } catch {
      // Intentional ignore.
      // TODO: If we add debug logging, then this should be logged. (SDK-973)
    }
  }

  function wrappedSend(this: XMLHttpRequest, ...args: any[]) {
    // We know these will be open arguments.
    originalSend.apply(this, args as any);

    // We know, if the data is present, that it has this shape, as we injected it.
    const data: LDXhrData = (this as any)[LD_DATA_XHR];
    if (data) {
      data.timestamp = Date.now();
    }
  }

  window.XMLHttpRequest.prototype.open = wrappedOpen;
  window.XMLHttpRequest.prototype.send = wrappedSend;

  try {
    // Use defineProperties to prevent these values from being enumerable.
    // The properties default to non-enumerable.
    Object.defineProperties(window.XMLHttpRequest, {
      [LD_ORIGINAL_XHR_OPEN]: {
        value: originalOpen,
        writable: true,
        configurable: true,
      },
      [LD_ORIGINAL_XHR_SEND]: {
        value: originalSend,
        writable: true,
        configurable: true,
      },
    });
  } catch {
    // Intentional ignore.
    // TODO: If we add debug logging, then this should be logged. (SDK-973)
  }
}
