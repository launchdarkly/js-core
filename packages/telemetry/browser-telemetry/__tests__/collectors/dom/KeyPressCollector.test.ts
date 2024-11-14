import { UiBreadcrumb } from '../../../src/api/Breadcrumb';
import { Recorder } from '../../../src/api/Recorder';
import KeypressCollector from '../../../src/collectors/dom/KeypressCollector';

// Mock the window object
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// Mock the document object
const mockDocument = {
  body: document.createElement('div'),
};

// Setup global mocks
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
});
global.document = mockDocument as any;

describe('given a KeypressCollector with a mock recorder', () => {
  let mockRecorder: Recorder;
  let collector: KeypressCollector;
  let keypressHandler: Function;

  beforeEach(() => {
    // Reset mocks
    mockAddEventListener.mockReset();
    mockRemoveEventListener.mockReset();

    // Capture the keypress handler when addEventListener is called
    mockAddEventListener.mockImplementation((event, handler) => {
      keypressHandler = handler;
    });

    // Create mock recorder
    mockRecorder = {
      addBreadcrumb: jest.fn(),
      captureError: jest.fn(),
      captureErrorEvent: jest.fn(),
    };

    // Create collector
    collector = new KeypressCollector();
  });

  it('adds a keypress event listener when created', () => {
    expect(mockAddEventListener).toHaveBeenCalledWith('keypress', expect.any(Function), true);
  });

  it('registers recorder and uses it for keypress events on input elements', () => {
    collector.register(mockRecorder, 'test-session');

    const mockTarget = document.createElement('input');
    mockTarget.className = 'test-input';
    document.body.appendChild(mockTarget);
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<UiBreadcrumb>({
        class: 'ui',
        type: 'input',
        level: 'info',
        timestamp: expect.any(Number),
        message: 'body > input.test-input',
      }),
    );
  });

  it('registers recorder and uses it for keypress events on textarea elements', () => {
    collector.register(mockRecorder, 'test-session');

    const mockTarget = document.createElement('textarea');
    mockTarget.className = 'test-textarea';
    document.body.appendChild(mockTarget);
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<UiBreadcrumb>({
        class: 'ui',
        type: 'input',
        level: 'info',
        timestamp: expect.any(Number),
        message: 'body > textarea.test-textarea',
      }),
    );
  });

  it('registers recorder and uses it for keypress events on contentEditable elements', () => {
    collector.register(mockRecorder, 'test-session');

    const mockTarget = document.createElement('p');
    mockTarget.className = 'test-editable';
    mockTarget.contentEditable = 'true';
    // https://github.com/jsdom/jsdom/issues/1670
    Object.defineProperties(mockTarget, {
      isContentEditable: {
        value: true,
      },
    });
    document.body.appendChild(mockTarget);
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<UiBreadcrumb>({
        class: 'ui',
        type: 'input',
        level: 'info',
        timestamp: expect.any(Number),
        message: 'body > p.test-editable',
      }),
    );
  });

  it('does not add breadcrumb for non-input non-editable elements', () => {
    collector.register(mockRecorder, 'test-session');

    const mockTarget = document.createElement('div');
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('stops adding breadcrumbs after unregistering', () => {
    collector.register(mockRecorder, 'test-session');
    collector.unregister();

    const mockTarget = document.createElement('input');
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('does not add a breadcrumb for a null target', () => {
    collector.register(mockRecorder, 'test-session');

    const mockEvent = { target: null } as KeyboardEvent;
    keypressHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('deduplicates events within throttle time', () => {
    collector.register(mockRecorder, 'test-session');

    const mockTarget = document.createElement('input');
    mockTarget.className = 'test-input';
    document.body.appendChild(mockTarget);
    const mockEvent = new KeyboardEvent('keypress');
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    // First event should be recorded
    keypressHandler(mockEvent);
    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledTimes(1);

    // Second event within throttle time should be ignored
    keypressHandler(mockEvent);
    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledTimes(1);
  });
});
