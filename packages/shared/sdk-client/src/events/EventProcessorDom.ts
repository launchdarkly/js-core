// import { ClientContext, internal } from '@launchdarkly/js-sdk-common';
//
// import EventSender from './EventSender';
//
// const a = () => {
//   const {
//     allAttributesPrivate,
//     capacity: eventsCapacity,
//     diagnosticRecordingInterval,
//     flushInterval,
//     logger,
//     privateAttributes,
//     serviceEndpoints,
//   } = config;
//
//   const eventProcessorOptions = {
//     allAttributesPrivate,
//     diagnosticRecordingInterval,
//     eventsCapacity,
//     flushInterval,
//     privateAttributes,
//   };
//
//   const clientContext = new ClientContext(
//     clientSideID,
//     { logger, offline: false, serviceEndpoints },
//     platform,
//   );
//
//   return new internal.EventProcessor(
//     eventProcessorOptions,
//     clientContext,
//     new EventSender(null, clientContext), //eventSender,
//     undefined,
//     null, //dm,
//   );
// };
