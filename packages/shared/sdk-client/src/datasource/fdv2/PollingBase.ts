import { internal, isHttpRecoverable, LDLogger } from '@launchdarkly/js-sdk-common';

import { processFlagEval } from '../flagEvalMapper';
import { FDv2Requestor } from './FDv2Requestor';
import {
  changeSet,
  errorInfoFromHttpError,
  errorInfoFromInvalidData,
  errorInfoFromNetworkError,
  errorInfoFromUnknown,
  FDv2SourceResult,
  goodbye,
  interrupted,
  terminalError,
} from './FDv2SourceResult';
import { FallbackDirective, readFallbackDirective } from './fallbackDirective';

function getEnvironmentId(headers: { get(name: string): string | null }): string | undefined {
  return headers.get('x-ld-envid') ?? undefined;
}

/**
 * Process FDv2 events using the protocol handler directly.
 *
 * We use `createProtocolHandler` rather than `PayloadProcessor` because
 * the PayloadProcessor does not surface goodbye/serverError actions:
 * it only forwards payloads and actionable errors. For polling results,
 * we need full control over all protocol action types.
 */
function processEvents(
  events: internal.FDv2Event[],
  fallback: FallbackDirective,
  environmentId: string | undefined,
  logger?: LDLogger,
): FDv2SourceResult {
  const handler = internal.createProtocolHandler(
    {
      'flag-eval': processFlagEval,
    },
    logger,
  );

  let earlyResult: FDv2SourceResult | undefined;

  events.forEach((event) => {
    if (earlyResult) {
      return;
    }

    const action = handler.processEvent(event);

    switch (action.type) {
      case 'payload':
        earlyResult = changeSet(action.payload, fallback, environmentId);
        break;
      case 'goodbye':
        // A plain goodbye is a status the orchestrator doesn't treat as an
        // error. When it's paired with a fallback directive, report it as a
        // terminal error instead so the orchestrator actually records the
        // error and moves off this source rather than quietly continuing.
        if (fallback.fdv1Fallback) {
          earlyResult = terminalError(errorInfoFromUnknown(action.reason), fallback);
        } else {
          earlyResult = goodbye(action.reason, fallback);
        }
        break;
      case 'serverError': {
        const errorInfo = errorInfoFromUnknown(action.reason);
        logger?.error(`Server error during polling: ${action.reason}`);
        earlyResult = interrupted(errorInfo, fallback);
        break;
      }
      case 'error': {
        if (action.kind === 'MISSING_PAYLOAD' || action.kind === 'PROTOCOL_ERROR') {
          const errorInfo = errorInfoFromInvalidData(action.message);
          logger?.warn(`Protocol error during polling: ${action.message}`);
          earlyResult = interrupted(errorInfo, fallback);
        } else {
          logger?.warn(action.message);
        }
        break;
      }
      default:
        break;
    }
  });

  if (earlyResult) {
    return earlyResult;
  }

  const errorInfo = errorInfoFromUnknown('Unexpected end of polling response');
  logger?.error('Unexpected end of polling response');
  return interrupted(errorInfo, fallback);
}

/**
 * Performs a single FDv2 poll request, processes the protocol response, and
 * returns an {@link FDv2SourceResult}.
 *
 * Recoverable errors produce interrupted results; unrecoverable HTTP errors
 * produce terminal errors.
 *
 * @internal
 */
export async function poll(
  requestor: FDv2Requestor,
  basis: string | undefined,
  logger?: LDLogger,
): Promise<FDv2SourceResult> {
  let directive: FallbackDirective = { fdv1Fallback: false };
  let environmentId: string | undefined;

  try {
    const response = await requestor.poll(basis);
    directive = readFallbackDirective(response.headers);
    environmentId = getEnvironmentId(response.headers);

    // 304 Not Modified: no payload has changed since the last poll.
    // Synthesize a 'none' payload so the orchestrator's changeSet path runs
    // normally without touching stored flags.
    if (response.status === 304) {
      const nonePayload: internal.Payload = {
        version: 0,
        type: 'none',
        updates: [],
      };
      return changeSet(nonePayload, directive, environmentId);
    }

    // Non-success HTTP status
    if (response.status < 200 || response.status >= 300) {
      const errorInfo = errorInfoFromHttpError(response.status);
      logger?.error(`Polling request failed with HTTP error: ${response.status}`);

      // status <= 0 means the request never got an HTTP response (e.g. a
      // network failure surfaced without a status code); treat that as
      // recoverable the same as a retryable HTTP status.
      const recoverable = response.status <= 0 || isHttpRecoverable(response.status);
      return recoverable ? interrupted(errorInfo, directive) : terminalError(errorInfo, directive);
    }

    // Successful response - process FDv2 events
    if (!response.body) {
      const errorInfo = errorInfoFromInvalidData('Empty response body');
      logger?.error('Polling request received empty response body');
      return interrupted(errorInfo, directive);
    }

    let parsed: internal.FDv2EventsCollection;
    try {
      parsed = JSON.parse(response.body) as internal.FDv2EventsCollection;
    } catch {
      const errorInfo = errorInfoFromInvalidData('Malformed JSON data in polling response');
      logger?.error('Polling request received malformed data');
      return interrupted(errorInfo, directive);
    }

    if (!Array.isArray(parsed.events)) {
      const errorInfo = errorInfoFromInvalidData(
        'Invalid polling response: missing or invalid events array',
      );
      logger?.error('Polling response does not contain a valid events array');
      return interrupted(errorInfo, directive);
    }

    return processEvents(parsed.events, directive, environmentId, logger);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    logger?.error(`Polling request failed with network error: ${message}`);
    const errorInfo = errorInfoFromNetworkError(message);
    return interrupted(errorInfo, directive);
  }
}
