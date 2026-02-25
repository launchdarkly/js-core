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

function getFallback(headers: { get(name: string): string | null }): boolean {
  const value = headers.get('x-ld-fd-fallback');
  return value !== null && value.toLowerCase() === 'true';
}

function getEnvironmentId(headers: { get(name: string): string | null }): string | undefined {
  return headers.get('x-ld-envid') ?? undefined;
}

/**
 * Process FDv2 events using the protocol handler directly.
 *
 * We use `createProtocolHandler` rather than `PayloadProcessor` because
 * the PayloadProcessor does not surface goodbye/serverError actions —
 * it only forwards payloads and actionable errors. For polling results,
 * we need full control over all protocol action types.
 */
function processEvents(
  events: internal.FDv2Event[],
  oneShot: boolean,
  fdv1Fallback: boolean,
  environmentId: string | undefined,
  logger?: LDLogger,
): FDv2SourceResult {
  const handler = internal.createProtocolHandler(
    {
      flagEval: processFlagEval,
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
        earlyResult = changeSet(action.payload, fdv1Fallback, environmentId);
        break;
      case 'goodbye':
        earlyResult = goodbye(action.reason, fdv1Fallback);
        break;
      case 'serverError': {
        const errorInfo = errorInfoFromUnknown(action.reason);
        logger?.error(`Server error during polling: ${action.reason}`);
        earlyResult = oneShot
          ? terminalError(errorInfo, fdv1Fallback)
          : interrupted(errorInfo, fdv1Fallback);
        break;
      }
      case 'error': {
        // Actionable protocol errors (MISSING_PAYLOAD, PROTOCOL_ERROR)
        if (action.kind === 'MISSING_PAYLOAD' || action.kind === 'PROTOCOL_ERROR') {
          const errorInfo = errorInfoFromInvalidData(action.message);
          logger?.warn(`Protocol error during polling: ${action.message}`);
          earlyResult = oneShot
            ? terminalError(errorInfo, fdv1Fallback)
            : interrupted(errorInfo, fdv1Fallback);
        } else {
          // Non-actionable errors (UNKNOWN_EVENT) are logged but don't stop processing
          logger?.warn(action.message);
        }
        break;
      }
      default:
        // 'none' — continue processing next event
        break;
    }
  });

  if (earlyResult) {
    return earlyResult;
  }

  // Events didn't produce a result
  const errorInfo = errorInfoFromUnknown('Unexpected end of polling response');
  logger?.error('Unexpected end of polling response');
  return oneShot ? terminalError(errorInfo, fdv1Fallback) : interrupted(errorInfo, fdv1Fallback);
}

/**
 * Performs a single FDv2 poll request, processes the protocol response, and
 * returns an {@link FDv2SourceResult}.
 *
 * The `oneShot` parameter controls error handling: when true (initializer),
 * all errors are terminal; when false (synchronizer), recoverable errors
 * produce interrupted results.
 *
 * @internal
 */
export async function poll(
  requestor: FDv2Requestor,
  basis: string | undefined,
  oneShot: boolean,
  logger?: LDLogger,
): Promise<FDv2SourceResult> {
  let fdv1Fallback = false;
  let environmentId: string | undefined;

  try {
    const response = await requestor.poll(basis);
    fdv1Fallback = getFallback(response.headers);
    environmentId = getEnvironmentId(response.headers);

    // 304 Not Modified: treat as server-intent with intentCode 'none'
    // (Spec Requirement 10.1.2)
    if (response.status === 304) {
      const nonePayload: internal.Payload = {
        id: '',
        version: 0,
        type: 'none',
        updates: [],
      };
      return changeSet(nonePayload, fdv1Fallback, environmentId);
    }

    // Non-success HTTP status
    if (response.status < 200 || response.status >= 300) {
      const errorInfo = errorInfoFromHttpError(response.status);
      logger?.error(`Polling request failed with HTTP error: ${response.status}`);

      if (oneShot) {
        return terminalError(errorInfo, fdv1Fallback);
      }

      const recoverable = response.status <= 0 || isHttpRecoverable(response.status);
      return recoverable
        ? interrupted(errorInfo, fdv1Fallback)
        : terminalError(errorInfo, fdv1Fallback);
    }

    // Successful response — process FDv2 events
    if (!response.body) {
      const errorInfo = errorInfoFromInvalidData('Empty response body');
      logger?.error('Polling request received empty response body');
      return oneShot
        ? terminalError(errorInfo, fdv1Fallback)
        : interrupted(errorInfo, fdv1Fallback);
    }

    let parsed: internal.FDv2EventsCollection;
    try {
      parsed = JSON.parse(response.body) as internal.FDv2EventsCollection;
    } catch {
      const errorInfo = errorInfoFromInvalidData('Malformed JSON data in polling response');
      logger?.error('Polling request received malformed data');
      return oneShot
        ? terminalError(errorInfo, fdv1Fallback)
        : interrupted(errorInfo, fdv1Fallback);
    }

    if (!Array.isArray(parsed.events)) {
      const errorInfo = errorInfoFromInvalidData(
        'Invalid polling response: missing or invalid events array',
      );
      logger?.error('Polling response does not contain a valid events array');
      return oneShot
        ? terminalError(errorInfo, fdv1Fallback)
        : interrupted(errorInfo, fdv1Fallback);
    }

    return processEvents(parsed.events, oneShot, fdv1Fallback, environmentId, logger);
  } catch (err: any) {
    // Network or other I/O error from the fetch itself
    const message = err?.message ?? String(err);
    logger?.error(`Polling request failed with network error: ${message}`);
    const errorInfo = errorInfoFromNetworkError(message);
    return oneShot ? terminalError(errorInfo, fdv1Fallback) : interrupted(errorInfo, fdv1Fallback);
  }
}
