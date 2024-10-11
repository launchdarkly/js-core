import { LDContext } from '@launchdarkly/js-sdk-common';

import { LDClient, LDMigrationStage, LDMigrationTracker } from './api';
import {
  LDMigration,
  LDMigrationOrigin,
  LDMigrationReadResult,
  LDMigrationResult,
  LDMigrationWriteResult,
} from './api/LDMigration';
import {
  LDConcurrentExecution,
  LDExecution,
  LDExecutionOrdering,
  LDMethodResult,
  LDMigrationOptions,
  LDSerialExecution,
} from './api/options/LDMigrationOptions';

type MultipleReadResult<TMigrationRead> = {
  fromOld: LDMigrationReadResult<TMigrationRead>;
  fromNew: LDMigrationReadResult<TMigrationRead>;
};

async function safeCall<TResult>(
  method: () => Promise<LDMethodResult<TResult>>,
): Promise<LDMethodResult<TResult>> {
  try {
    // Awaiting to allow catching.
    const res = await method();
    return res;
  } catch (error: any) {
    return {
      success: false,
      error,
    };
  }
}

/**
 * Report a successful migration operation from `readNew`, `readOld`, `writeNew` or `writeOld`.
 *
 * ```
 * readNew: async () => {
 *   const myResult = doMyOldRead();
 *   if(myResult.wasGood) {
 *     return LDMigrationSuccess(myResult);
 *   }
 *   return LDMigrationError(myResult.error)
 * }
 * ```
 *
 * @param result The result of the operation.
 * @returns An {@link LDMethodResult}
 */
export function LDMigrationSuccess<TResult>(result: TResult): LDMethodResult<TResult> {
  return {
    success: true,
    result,
  };
}

/**
 * Report a failed migration operation from `readNew`, `readOld`, `writeNew` or `writeOld`.
 *
 * ```
 * readNew: async () => {
 *   const myResult = doMyOldRead();
 *   if(myResult.wasGood) {
 *     return LDMigrationSuccess(myResult);
 *   }
 *   return LDMigrationError(myResult.error)
 * }
 * ```
 *
 * @param result The result of the operations.
 * @returns An {@link LDMethodResult}
 */
export function LDMigrationError(error: Error): { success: false; error: Error } {
  return {
    success: false,
    error,
  };
}

interface MigrationContext<TPayload> {
  payload?: TPayload;
  tracker: LDMigrationTracker;
}

/**
 * Class which allows performing technology migrations.
 */
class Migration<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput = any,
  TMigrationWriteInput = any,
> implements
    LDMigration<TMigrationRead, TMigrationWrite, TMigrationReadInput, TMigrationWriteInput>
{
  private readonly _execution: LDSerialExecution | LDConcurrentExecution;

  private readonly _errorTracking: boolean;

  private readonly _latencyTracking: boolean;

  private readonly _readTable: {
    [index: string]: (
      context: MigrationContext<TMigrationReadInput>,
    ) => Promise<LDMigrationReadResult<TMigrationRead>>;
  } = {
    [LDMigrationStage.Off]: async (context) =>
      this._doSingleOp(context, 'old', this._config.readOld.bind(this._config)),
    [LDMigrationStage.DualWrite]: async (context) =>
      this._doSingleOp(context, 'old', this._config.readOld.bind(this._config)),
    [LDMigrationStage.Shadow]: async (context) => {
      const { fromOld, fromNew } = await this._doRead(context);

      this._trackConsistency(context, fromOld, fromNew);

      return fromOld;
    },
    [LDMigrationStage.Live]: async (context) => {
      const { fromNew, fromOld } = await this._doRead(context);

      this._trackConsistency(context, fromOld, fromNew);

      return fromNew;
    },
    [LDMigrationStage.RampDown]: async (context) =>
      this._doSingleOp(context, 'new', this._config.readNew.bind(this._config)),
    [LDMigrationStage.Complete]: async (context) =>
      this._doSingleOp(context, 'new', this._config.readNew.bind(this._config)),
  };

  private readonly _writeTable: {
    [index: string]: (
      context: MigrationContext<TMigrationWriteInput>,
    ) => Promise<LDMigrationWriteResult<TMigrationWrite>>;
  } = {
    [LDMigrationStage.Off]: async (context) => ({
      authoritative: await this._doSingleOp(
        context,
        'old',
        this._config.writeOld.bind(this._config),
      ),
    }),
    [LDMigrationStage.DualWrite]: async (context) => {
      const fromOld = await this._doSingleOp(
        context,
        'old',
        this._config.writeOld.bind(this._config),
      );
      if (!fromOld.success) {
        return {
          authoritative: fromOld,
        };
      }

      const fromNew = await this._doSingleOp(
        context,
        'new',
        this._config.writeNew.bind(this._config),
      );

      return {
        authoritative: fromOld,
        nonAuthoritative: fromNew,
      };
    },
    [LDMigrationStage.Shadow]: async (context) => {
      const fromOld = await this._doSingleOp(
        context,
        'old',
        this._config.writeOld.bind(this._config),
      );
      if (!fromOld.success) {
        return {
          authoritative: fromOld,
        };
      }

      const fromNew = await this._doSingleOp(
        context,
        'new',
        this._config.writeNew.bind(this._config),
      );

      return {
        authoritative: fromOld,
        nonAuthoritative: fromNew,
      };
    },
    [LDMigrationStage.Live]: async (context) => {
      const fromNew = await this._doSingleOp(
        context,
        'new',
        this._config.writeNew.bind(this._config),
      );
      if (!fromNew.success) {
        return {
          authoritative: fromNew,
        };
      }

      const fromOld = await this._doSingleOp(
        context,
        'old',
        this._config.writeOld.bind(this._config),
      );

      return {
        authoritative: fromNew,
        nonAuthoritative: fromOld,
      };
    },
    [LDMigrationStage.RampDown]: async (context) => {
      const fromNew = await this._doSingleOp(
        context,
        'new',
        this._config.writeNew.bind(this._config),
      );
      if (!fromNew.success) {
        return {
          authoritative: fromNew,
        };
      }

      const fromOld = await this._doSingleOp(
        context,
        'old',
        this._config.writeOld.bind(this._config),
      );

      return {
        authoritative: fromNew,
        nonAuthoritative: fromOld,
      };
    },
    [LDMigrationStage.Complete]: async (context) => ({
      authoritative: await this._doSingleOp(
        context,
        'new',
        this._config.writeNew.bind(this._config),
      ),
    }),
  };

  constructor(
    private readonly _client: LDClient,
    private readonly _config: LDMigrationOptions<
      TMigrationRead,
      TMigrationWrite,
      TMigrationReadInput,
      TMigrationWriteInput
    >,
  ) {
    if (this._config.execution) {
      this._execution = this._config.execution;
    } else {
      this._execution = new LDConcurrentExecution();
    }

    this._latencyTracking = this._config.latencyTracking ?? true;
    this._errorTracking = this._config.errorTracking ?? true;
  }

  async read(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationReadInput,
  ): Promise<LDMigrationReadResult<TMigrationRead>> {
    const stage = await this._client.migrationVariation(key, context, defaultStage);
    const res = await this._readTable[stage.value]({
      payload,
      tracker: stage.tracker,
    });
    stage.tracker.op('read');
    this._sendEvent(stage.tracker);
    return res;
  }

  async write(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationWriteInput,
  ): Promise<LDMigrationWriteResult<TMigrationWrite>> {
    const stage = await this._client.migrationVariation(key, context, defaultStage);
    const res = await this._writeTable[stage.value]({
      payload,
      tracker: stage.tracker,
    });
    stage.tracker.op('write');
    this._sendEvent(stage.tracker);
    return res;
  }

  private _sendEvent(tracker: LDMigrationTracker) {
    const event = tracker.createEvent();
    if (event) {
      this._client.trackMigration(event);
    }
  }

  private _trackConsistency(
    context: MigrationContext<TMigrationReadInput>,
    oldValue: LDMethodResult<TMigrationRead>,
    newValue: LDMethodResult<TMigrationRead>,
  ) {
    if (!this._config.check) {
      return;
    }

    if (oldValue.success && newValue.success) {
      // Check is validated before this point, so it is force unwrapped.
      context.tracker.consistency(() => this._config.check!(oldValue.result, newValue.result));
    }
  }

  private async _readSequentialFixed(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOld = await this._doSingleOp(context, 'old', this._config.readOld.bind(this._config));
    const fromNew = await this._doSingleOp(context, 'new', this._config.readNew.bind(this._config));
    return { fromOld, fromNew };
  }

  private async _readConcurrent(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOldPromise = this._doSingleOp(
      context,
      'old',
      this._config.readOld.bind(this._config),
    );
    const fromNewPromise = this._doSingleOp(
      context,
      'new',
      this._config.readNew.bind(this._config),
    );
    const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

    return { fromOld, fromNew };
  }

  private async _readSequentialRandom(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    // This number is not used for a purpose requiring cryptographic security.
    const randomIndex = Math.floor(Math.random() * 2);

    // Effectively flip a coin and do it on one order or the other.
    if (randomIndex === 0) {
      const fromOld = await this._doSingleOp(
        context,
        'old',
        this._config.readOld.bind(this._config),
      );
      const fromNew = await this._doSingleOp(
        context,
        'new',
        this._config.readNew.bind(this._config),
      );
      return { fromOld, fromNew };
    }
    const fromNew = await this._doSingleOp(context, 'new', this._config.readNew.bind(this._config));
    const fromOld = await this._doSingleOp(context, 'old', this._config.readOld.bind(this._config));
    return { fromOld, fromNew };
  }

  private async _doRead(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    if (this._execution?.type === LDExecution.Serial) {
      const serial = this._execution as LDSerialExecution;
      if (serial.ordering === LDExecutionOrdering.Fixed) {
        return this._readSequentialFixed(context);
      }
      return this._readSequentialRandom(context);
    }
    return this._readConcurrent(context);
  }

  private async _doSingleOp<TInput, TOutput>(
    context: MigrationContext<TInput>,
    origin: LDMigrationOrigin,
    method: (payload?: TInput) => Promise<LDMethodResult<TOutput>>,
  ): Promise<LDMigrationResult<TOutput>> {
    context.tracker.invoked(origin);
    const res = await this._trackLatency(context.tracker, origin, () =>
      safeCall(() => method(context.payload)),
    );
    if (!res.success && this._errorTracking) {
      context.tracker.error(origin);
    }
    return { origin, ...res };
  }

  private async _trackLatency<TResult>(
    tracker: LDMigrationTracker,
    origin: LDMigrationOrigin,
    method: () => Promise<TResult>,
  ): Promise<TResult> {
    if (!this._latencyTracking) {
      return method();
    }
    let start;
    let end;
    let result: TResult;
    // TODO: Need to validate performance existence check with edge SDKs.
    if (typeof performance !== 'undefined') {
      start = performance.now();
      result = await method();
      end = performance.now();
    } else {
      start = Date.now();
      result = await method();
      end = Date.now();
    }

    // Performance timer is in ms, but may have a microsecond resolution
    // fractional component.
    const latency = end - start;
    tracker.latency(origin, latency);
    return result;
  }
}

export function createMigration<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput = any,
  TMigrationWriteInput = any,
>(
  client: LDClient,
  config: LDMigrationOptions<
    TMigrationRead,
    TMigrationWrite,
    TMigrationReadInput,
    TMigrationWriteInput
  >,
): LDMigration<TMigrationRead, TMigrationWrite, TMigrationReadInput, TMigrationWriteInput> {
  return new Migration(client, config);
}
