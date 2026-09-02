import { fdv1PayloadAdaptor as FDv1PayloadAdaptor } from './FDv1PayloadAdaptor';
import {
  DEFAULT_FDV1_FALLBACK_TTL_MS,
  readFallbackDirective,
  readGoodbyeFallbackDirective,
  resolveFallbackTtlMs,
} from './fallbackDirective';
import type { FallbackDirective } from './fallbackDirective';
import { PayloadProcessor } from './payloadProcessor';
import { PayloadStreamReader } from './payloadStreamReader';
import type { FDv2Event, FDv2EventsCollection } from './proto';
import { createProtocolHandler } from './protocolHandler';
import type {
  ObjProcessors,
  Payload,
  PayloadListener,
  PayloadType,
  ProtocolAction,
  ProtocolErrorKind,
  ProtocolHandler,
  ProtocolState,
  Update,
} from './protocolHandler';

export {
  createProtocolHandler,
  DEFAULT_FDV1_FALLBACK_TTL_MS,
  FDv1PayloadAdaptor,
  PayloadProcessor,
  PayloadStreamReader,
  readFallbackDirective,
  readGoodbyeFallbackDirective,
  resolveFallbackTtlMs,
};

export type {
  FallbackDirective,
  FDv2Event,
  FDv2EventsCollection,
  ObjProcessors,
  Payload,
  PayloadListener,
  PayloadType,
  ProtocolAction,
  ProtocolErrorKind,
  ProtocolHandler,
  ProtocolState,
  Update,
};
