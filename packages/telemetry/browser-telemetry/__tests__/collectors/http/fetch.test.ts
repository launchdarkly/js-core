import { HttpBreadcrumb } from '../../../src/api/Breadcrumb';
import { MinLogger } from '../../../src/api/MinLogger';
import { Recorder } from '../../../src/api/Recorder';
import FetchCollector from '../../../src/collectors/http/fetch';

const initialFetch = window.fetch;

describe('given a FetchCollector with a mock recorder', () => {
  let mockRecorder: Recorder;
  let collector: FetchCollector;

  beforeEach(() => {
    // Create mock recorder
    mockRecorder = {
      addBreadcrumb: jest.fn(),
      captureError: jest.fn(),
      captureErrorEvent: jest.fn(),
    };
    // Create collector with default options
    collector = new FetchCollector({
      urlFilters: [], // Add required urlFilters property
    });
  });

  it('registers recorder and uses it for fetch calls', async () => {
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    await fetch('https://api.example.com/data', {
      method: 'POST',
      body: JSON.stringify({ test: true }),
    });

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<HttpBreadcrumb>({
        class: 'http',
        type: 'fetch',
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

  it('stops adding breadcrumbs after unregistering', async () => {
    collector.register(mockRecorder, 'test-session');
    collector.unregister();

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    await fetch('https://api.example.com/data');

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('filters URLs based on provided options', async () => {
    collector = new FetchCollector({
      urlFilters: [(url: string) => url.replace(/token=.*/, 'token=REDACTED')], // Convert urlFilter to urlFilters array
    });
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    await fetch('https://api.example.com/data?token=secret123');

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<HttpBreadcrumb>({
        data: {
          method: 'GET',
          url: 'https://api.example.com/data?token=REDACTED',
          statusCode: 200,
          statusText: 'OK',
        },
        class: 'http',
        timestamp: expect.any(Number),
        level: 'info',
        type: 'fetch',
      }),
    );
  });

  it('handles fetch calls with Request objects', async () => {
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    const request = new Request('https://api.example.com/data', {
      method: 'PUT',
      body: JSON.stringify({ test: true }),
    });
    await fetch(request);

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<HttpBreadcrumb>({
        data: {
          method: 'PUT',
          url: 'https://api.example.com/data',
          statusCode: 200,
          statusText: 'OK',
        },
        class: 'http',
        timestamp: expect.any(Number),
        level: 'info',
        type: 'fetch',
      }),
    );
  });

  it('handles fetch calls with URL objects', async () => {
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    const url = new URL('https://api.example.com/data');
    await fetch(url);

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<HttpBreadcrumb>({
        data: {
          method: 'GET',
          url: 'https://api.example.com/data',
          statusCode: 200,
          statusText: 'OK',
        },
        class: 'http',
        timestamp: expect.any(Number),
        level: 'info',
        type: 'fetch',
      }),
    );
  });
});

describe('given a FetchCollector with a URL filter that throws an error', () => {
  let mockRecorder: Recorder;
  let collector: FetchCollector;
  let mockLogger: MinLogger;
  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
    };
    // Create mock recorder
    mockRecorder = {
      addBreadcrumb: jest.fn(),
      captureError: jest.fn(),
      captureErrorEvent: jest.fn(),
    };
    collector = new FetchCollector({
      urlFilters: [
        () => {
          throw new Error('test error');
        },
      ],
      getLogger: () => mockLogger,
    });
  });

  it('logs an error if it fails to filter a breadcrumb', async () => {
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    await fetch('https://api.example.com/data');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Error filtering http breadcrumb',
      new Error('test error'),
    );
    expect(initialFetch).toHaveBeenCalledWith('https://api.example.com/data');

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('only logs the filter error once for multiple requests', async () => {
    collector.register(mockRecorder, 'test-session');

    const mockResponse = new Response('test response', { status: 200, statusText: 'OK' });
    (initialFetch as jest.Mock).mockResolvedValue(mockResponse);

    // Make multiple fetch calls that will trigger the filter error
    await fetch('https://api.example.com/data');
    await fetch('https://api.example.com/data2');
    await fetch('https://api.example.com/data3');

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Error filtering http breadcrumb',
      new Error('test error'),
    );
    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });
});
