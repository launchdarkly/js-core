# LaunchDarkly JavaScript Browser SDK -- Examples

This directory contains example applications demonstrating the LaunchDarkly JavaScript Browser SDK.

| Example                                                       | Description                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [getting-started](./getting-started/)                         | Minimal browser app that evaluates a boolean feature flag and displays the result with real-time updates. This is the recommended starting point.    |
| [features/custom-eventsource](./features/custom-eventsource/) | Passes a `fetch()`-based EventSource as the `eventSource` option so that `usePost` also applies to the streaming connection.                         |
| [features/data-saving-mode](./features/data-saving-mode/)     | Enables the FDv2 data system (`dataSystem`) and exposes controls for connection mode, streaming, context switching, and event handlers. EAP feature. |
