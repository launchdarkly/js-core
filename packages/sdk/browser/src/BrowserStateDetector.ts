import { addDocumentEventListener, addWindowEventListener, getVisibility } from './BrowserApi';

export function registerStateDetection(requestFlush: () => void): () => void {
  // When the visibility of the page changes to hidden we want to flush any pending events.
  //
  // This is handled with visibility, instead of beforeunload/unload
  // because those events are not compatible with the bfcache and are unlikely
  // to be called in many situations. For more information see: https://developer.chrome.com/blog/page-lifecycle-api/
  //
  // Redundancy is included by using both the visibilitychange handler as well as
  // pagehide, because different browsers, and versions have different bugs with each.
  // This also may provide more opportunity for the events to get flushed.
  //
  const handleVisibilityChange = () => {
    if (getVisibility() === 'hidden') {
      requestFlush();
    }
  };

  const removeDocListener = addDocumentEventListener('visibilitychange', handleVisibilityChange);
  const removeWindowListener = addWindowEventListener('pagehide', requestFlush);

  return () => {
    removeDocListener();
    removeWindowListener();
  };
}
