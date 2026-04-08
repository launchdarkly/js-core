import { CommandParams, CommandType, ValueType } from '../types/CommandParams.js';
import { CommandableClient } from './CommandableClient.js';

export const badCommandError = new Error('unsupported command');
export const malformedCommand = new Error('command was malformed');

/**
 * Dispatches a test harness command to the appropriate SDK client method.
 * Shared across all client-side entities.
 *
 * NOTE: Maybe in the future we will need to make this more flexible to support
 * more complex contract tests scenarios. We can look into creating a builder
 * for this this function.
 */
export async function doCommand(
  client: CommandableClient,
  params: CommandParams,
): Promise<unknown> {
  switch (params.command) {
    case CommandType.EvaluateFlag: {
      const evaluationParams = params.evaluate;
      if (!evaluationParams) {
        throw malformedCommand;
      }
      if (evaluationParams.detail) {
        switch (evaluationParams.valueType) {
          case ValueType.Bool:
            return client.boolVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as boolean,
            );
          case ValueType.Int: // Intentional fallthrough.
          case ValueType.Double:
            return client.numberVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as number,
            );
          case ValueType.String:
            return client.stringVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as string,
            );
          default:
            return client.variationDetail(evaluationParams.flagKey, evaluationParams.defaultValue);
        }
      }
      switch (evaluationParams.valueType) {
        case ValueType.Bool:
          return {
            value: client.boolVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as boolean,
            ),
          };
        case ValueType.Int: // Intentional fallthrough.
        case ValueType.Double:
          return {
            value: client.numberVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as number,
            ),
          };
        case ValueType.String:
          return {
            value: client.stringVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as string,
            ),
          };
        default:
          return {
            value: client.variation(evaluationParams.flagKey, evaluationParams.defaultValue),
          };
      }
    }

    case CommandType.EvaluateAllFlags:
      return { state: client.allFlags() };

    case CommandType.IdentifyEvent: {
      const identifyParams = params.identifyEvent;
      if (!identifyParams) {
        throw malformedCommand;
      }
      await client.identify(identifyParams.user || identifyParams.context);
      return undefined;
    }

    case CommandType.CustomEvent: {
      const customEventParams = params.customEvent;
      if (!customEventParams) {
        throw malformedCommand;
      }
      client.track(
        customEventParams.eventKey,
        customEventParams.data,
        customEventParams.metricValue,
      );
      return undefined;
    }

    case CommandType.FlushEvents:
      await client.flush();
      return undefined;

    default:
      throw badCommandError;
  }
}
