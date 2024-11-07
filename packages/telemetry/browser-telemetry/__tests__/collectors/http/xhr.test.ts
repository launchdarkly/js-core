import { HttpBreadcrumb } from '../../../src/api/Breadcrumb';
import { Recorder } from '../../../src/api/Recorder';
import XhrCollector from '../../../src/collectors/http/xhr';

const initialXhr = window.XMLHttpRequest;

it('registers recorder and uses it for xhr calls', () => {
  const mockRecorder: Recorder = {
    addBreadcrumb: jest.fn(),
    captureError: jest.fn(),
    captureErrorEvent: jest.fn(),
  };

  const collector = new XhrCollector({
    urlFilters: [],
  });

  collector.register(mockRecorder, 'test-session');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.example.com/data');
  xhr.send(JSON.stringify({ test: true }));

  // Simulate successful response
  Object.defineProperty(xhr, 'status', { value: 200 });
  Object.defineProperty(xhr, 'statusText', { value: 'OK' });
  xhr.dispatchEvent(new Event('loadend'));

  expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining<HttpBreadcrumb>({
      class: 'http',
      type: 'xhr',
      level: 'info',
      timestamp: expect.any(Number),
      data: {
        method: 'POST',
        url: 'https://api.example.com/data',
        statusCode: 200,
        statusText: 'OK',
      },
    }),
  );
});

it('stops adding breadcrumbs after unregistering', () => {
  const mockRecorder: Recorder = {
    addBreadcrumb: jest.fn(),
    captureError: jest.fn(),
    captureErrorEvent: jest.fn(),
  };

  const collector = new XhrCollector({
    urlFilters: [],
  });

  collector.register(mockRecorder, 'test-session');
  collector.unregister();

  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.example.com/data');
  xhr.send();

  xhr.dispatchEvent(new Event('loadend'));

  expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
});

it('marks requests with error events as errors', () => {
  const mockRecorder: Recorder = {
    addBreadcrumb: jest.fn(),
    captureError: jest.fn(),
    captureErrorEvent: jest.fn(),
  };

  const collector = new XhrCollector({
    urlFilters: [],
  });

  collector.register(mockRecorder, 'test-session');

  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.example.com/data');
  xhr.send();

  xhr.dispatchEvent(new Event('error'));
  xhr.dispatchEvent(new Event('loadend'));

  expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining<HttpBreadcrumb>({
      level: 'error',
      data: expect.objectContaining({
        method: 'GET',
        statusCode: 0,
        statusText: '',
        url: 'https://api.example.com/data',
      }),
      class: 'http',
      timestamp: expect.any(Number),
      type: 'xhr',
    }),
  );
});

it('applies URL filters to requests', () => {
  const mockRecorder: Recorder = {
    addBreadcrumb: jest.fn(),
    captureError: jest.fn(),
    captureErrorEvent: jest.fn(),
  };

  const collector = new XhrCollector({
    urlFilters: [(url) => url.replace(/token=.*/, 'token=REDACTED')],
  });

  collector.register(mockRecorder, 'test-session');

  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.example.com/data?token=secret123');
  xhr.send();

  Object.defineProperty(xhr, 'status', { value: 200 });
  xhr.dispatchEvent(new Event('loadend'));

  expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining<HttpBreadcrumb>({
      data: expect.objectContaining({
        url: 'https://api.example.com/data?token=REDACTED',
      }),
      class: 'http',
      timestamp: expect.any(Number),
      level: 'info',
      type: 'xhr',
    }),
  );
});

afterEach(() => {
  window.XMLHttpRequest = initialXhr;
});
