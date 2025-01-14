import { UiBreadcrumb } from '../../../src/api/Breadcrumb';
import { Recorder } from '../../../src/api/Recorder';
import ClickCollector from '../../../src/collectors/dom/ClickCollector';

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

describe('given a ClickCollector with a mock recorder', () => {
  let mockRecorder: Recorder;
  let collector: ClickCollector;
  let clickHandler: Function;

  beforeEach(() => {
    // Reset mocks
    mockAddEventListener.mockReset();
    mockRemoveEventListener.mockReset();

    // Capture the click handler when addEventListener is called
    mockAddEventListener.mockImplementation((event, handler) => {
      clickHandler = handler;
    });
    // Create mock recorder
    mockRecorder = {
      addBreadcrumb: jest.fn(),
      captureError: jest.fn(),
      captureErrorEvent: jest.fn(),
      captureSession: jest.fn(),
    };

    // Create collector
    collector = new ClickCollector();
  });

  it('adds a click event listener when created', () => {
    expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
  });

  it('registers recorder and uses it for click events', () => {
    // Register the recorder
    collector.register(mockRecorder, 'test-session');

    // Simulate a click event
    const mockTarget = document.createElement('button');
    mockTarget.className = 'test-button';
    document.body.appendChild(mockTarget);
    const mockEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    // Call the captured click handler
    clickHandler(mockEvent);

    // Verify breadcrumb was added with correct properties
    expect(mockRecorder.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining<UiBreadcrumb>({
        class: 'ui',
        type: 'click',
        level: 'info',
        timestamp: expect.any(Number),
        message: 'body > button.test-button',
      }),
    );
  });

  it('stops adding breadcrumbs after unregistering', () => {
    // Register then unregister
    collector.register(mockRecorder, 'test-session');
    collector.unregister();
    // Simulate click
    const mockTarget = document.createElement('button');
    const mockEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(mockEvent, 'target', { value: mockTarget });

    clickHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('does not add a bread crumb for a null target', () => {
    collector.register(mockRecorder, 'test-session');

    const mockEvent = { target: null } as MouseEvent;
    clickHandler(mockEvent);

    expect(mockRecorder.addBreadcrumb).not.toHaveBeenCalled();
  });
});
