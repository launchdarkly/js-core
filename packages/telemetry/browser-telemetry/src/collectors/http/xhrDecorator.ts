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

export default function decorateXhr(callback: (breadcrumb: HttpBreadcrumb) => void) {
  // In these functions we add type annotations for `this`. The impact here should just
  // be that we get correct typing for typescript. They should not affect the output.

  function wrappedOpen(this: XMLHttpRequest, ...args: any[]) {
    // Listen to error so we can tag this request as having an error. If there is no error event
    // then the request will assume to not have errored.
    this.addEventListener('error', function (_event: ProgressEvent<XMLHttpRequestEventTarget>) {
      // We know, if the data is present, that it has this shape, as we injected it.
      // @ts-ignore
      const data: LDXhrData = this[LD_DATA_XHR];
      data.error = true;
    });

    this.addEventListener(
      'loadend',
      function (_event: ProgressEvent<XMLHttpRequestEventTarget>) {
        // We know, if the data is present, that it has this shape, as we injected it.
        // @ts-ignore
        const data: LDXhrData = this[LD_DATA_XHR];
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
    // @ts-ignore
    originalOpen.apply(this, args);

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
      // TODO: If we add debug logging, then this should be logged.
    }
  }

  function wrappedSend(this: XMLHttpRequest, ...args: any[]) {
    // We know these will be open arguments.
    // @ts-ignore
    originalSend.apply(this, args);

    // We know, if the data is present, that it has this shape, as we injected it.
    // @ts-ignore
    const data: LDXhrData = this[LD_DATA_XHR];
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
    // TODO: If we add debug logging, then this should be logged.
  }
}
