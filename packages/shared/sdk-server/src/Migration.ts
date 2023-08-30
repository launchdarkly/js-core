import { internal, LDContext } from '@launchdarkly/js-sdk-common';

import { LDClient, LDConsistencyCheck, LDMigrationStage, LDMigrationTracker } from './api';
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

const { shouldSample } = internal;

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
  checkRatio?: number;
}

/**
 * Class which allows performing technology migrations.
 */
export default class Migration<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput = any,
  TMigrationWriteInput = any,
> implements
    LDMigration<TMigrationRead, TMigrationWrite, TMigrationReadInput, TMigrationWriteInput>
{
  private readonly execution: LDSerialExecution | LDConcurrentExecution;

  private readonly errorTracking: boolean;

  private readonly latencyTracking: boolean;

  private readonly readTable: {
    [index: string]: (
      context: MigrationContext<TMigrationReadInput>,
    ) => Promise<LDMigrationReadResult<TMigrationRead>>;
  } = {
    [LDMigrationStage.Off]: async (context) =>
      this.doSingleOp(context, 'old', this.config.readOld.bind(this.config)),
    [LDMigrationStage.DualWrite]: async (context) =>
      this.doSingleOp(context, 'old', this.config.readOld.bind(this.config)),
    [LDMigrationStage.Shadow]: async (context) => {
      const { fromOld, fromNew } = await this.doRead(context);

      this.trackConsistency(context, fromOld, fromNew);

      return fromOld;
    },
    [LDMigrationStage.Live]: async (context) => {
      const { fromNew, fromOld } = await this.doRead(context);

      this.trackConsistency(context, fromOld, fromNew);

      return fromNew;
    },
    [LDMigrationStage.RampDown]: async (context) =>
      this.doSingleOp(context, 'new', this.config.readNew.bind(this.config)),
    [LDMigrationStage.Complete]: async (context) =>
      this.doSingleOp(context, 'new', this.config.readNew.bind(this.config)),
  };

  private readonly writeTable: {
    [index: string]: (
      context: MigrationContext<TMigrationWriteInput>,
    ) => Promise<LDMigrationWriteResult<TMigrationWrite>>;
  } = {
    [LDMigrationStage.Off]: async (context) => ({
      authoritative: await this.doSingleOp(context, 'old', this.config.writeOld.bind(this.config)),
    }),
    [LDMigrationStage.DualWrite]: async (context) => {
      const fromOld = await this.doSingleOp(context, 'old', this.config.writeOld.bind(this.config));
      if (!fromOld.success) {
        return {
          authoritative: fromOld,
        };
      }

      const fromNew = await this.doSingleOp(context, 'new', this.config.writeNew.bind(this.config));

      return {
        authoritative: fromOld,
        nonAuthoritative: fromNew,
      };
    },
    [LDMigrationStage.Shadow]: async (context) => {
      const fromOld = await this.doSingleOp(context, 'old', this.config.writeOld.bind(this.config));
      if (!fromOld.success) {
        return {
          authoritative: fromOld,
        };
      }

      const fromNew = await this.doSingleOp(context, 'new', this.config.writeNew.bind(this.config));

      return {
        authoritative: fromOld,
        nonAuthoritative: fromNew,
      };
    },
    [LDMigrationStage.Live]: async (context) => {
      const fromNew = await this.doSingleOp(context, 'new', this.config.writeNew.bind(this.config));
      if (!fromNew.success) {
        return {
          authoritative: fromNew,
        };
      }

      const fromOld = await this.doSingleOp(context, 'old', this.config.writeOld.bind(this.config));

      return {
        authoritative: fromNew,
        nonAuthoritative: fromOld,
      };
    },
    [LDMigrationStage.RampDown]: async (context) => {
      const fromNew = await this.doSingleOp(context, 'new', this.config.writeNew.bind(this.config));
      if (!fromNew.success) {
        return {
          authoritative: fromNew,
        };
      }

      const fromOld = await this.doSingleOp(context, 'old', this.config.writeOld.bind(this.config));

      return {
        authoritative: fromNew,
        nonAuthoritative: fromOld,
      };
    },
    [LDMigrationStage.Complete]: async (context) => ({
      authoritative: await this.doSingleOp(context, 'new', this.config.writeNew.bind(this.config)),
    }),
  };

  constructor(
    private readonly client: LDClient,
    private readonly config: LDMigrationOptions<
      TMigrationRead,
      TMigrationWrite,
      TMigrationReadInput,
      TMigrationWriteInput
    >,
  ) {
    if (this.config.execution) {
      this.execution = this.config.execution;
    } else {
      this.execution = new LDConcurrentExecution();
    }

    this.latencyTracking = this.config.latencyTracking ?? true;
    this.errorTracking = this.config.errorTracking ?? true;
  }

  async read(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationReadInput,
  ): Promise<LDMigrationReadResult<TMigrationRead>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.readTable[stage.value]({
      payload,
      tracker: stage.tracker,
      checkRatio: stage.checkRatio,
    });
    stage.tracker.op('read');
    this.sendEvent(stage.tracker);
    return res;
  }

  async write(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationWriteInput,
  ): Promise<LDMigrationWriteResult<TMigrationWrite>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.writeTable[stage.value]({
      payload,
      tracker: stage.tracker,
    });
    stage.tracker.op('write');
    this.sendEvent(stage.tracker);
    return res;
  }

  private sendEvent(tracker: LDMigrationTracker) {
    const event = tracker.createEvent();
    if (event) {
      this.client.trackMigration(event);
    }
  }

  private trackConsistency(
    context: MigrationContext<TMigrationReadInput>,
    oldValue: LDMethodResult<TMigrationRead>,
    newValue: LDMethodResult<TMigrationRead>,
  ) {
    if (this.config.check && shouldSample(context.checkRatio ?? 1)) {
      if (oldValue.success && newValue.success) {
        const res = this.config.check(oldValue.result, newValue.result);
        context.tracker.consistency(
          res ? LDConsistencyCheck.Consistent : LDConsistencyCheck.Inconsistent,
        );
      }
    }
  }

  private async readSequentialFixed(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOld = await this.doSingleOp(context, 'old', this.config.readOld.bind(this.config));
    const fromNew = await this.doSingleOp(context, 'new', this.config.readNew.bind(this.config));
    return { fromOld, fromNew };
  }

  private async readConcurrent(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOldPromise = this.doSingleOp(context, 'old', this.config.readOld.bind(this.config));
    const fromNewPromise = this.doSingleOp(context, 'new', this.config.readNew.bind(this.config));
    const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

    return { fromOld, fromNew };
  }

  private async readSequentialRandom(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    // This number is not used for a purpose requiring cryptographic security.
    const randomIndex = Math.floor(Math.random() * 2);

    // Effectively flip a coin and do it on one order or the other.
    if (randomIndex === 0) {
      const fromOld = await this.doSingleOp(context, 'old', this.config.readOld.bind(this.config));
      const fromNew = await this.doSingleOp(context, 'new', this.config.readNew.bind(this.config));
      return { fromOld, fromNew };
    }
    const fromNew = await this.doSingleOp(context, 'new', this.config.readNew.bind(this.config));
    const fromOld = await this.doSingleOp(context, 'old', this.config.readOld.bind(this.config));
    return { fromOld, fromNew };
  }

  private async doRead(
    context: MigrationContext<TMigrationReadInput>,
  ): Promise<MultipleReadResult<TMigrationRead>> {
    if (this.execution?.type === LDExecution.Serial) {
      const serial = this.execution as LDSerialExecution;
      if (serial.ordering === LDExecutionOrdering.Fixed) {
        return this.readSequentialFixed(context);
      }
      return this.readSequentialRandom(context);
    }
    return this.readConcurrent(context);
  }

  private async doSingleOp<TInput, TOutput>(
    context: MigrationContext<TInput>,
    origin: LDMigrationOrigin,
    method: (payload?: TInput) => Promise<LDMethodResult<TOutput>>,
  ): Promise<LDMigrationResult<TOutput>> {
    context.tracker.invoked(origin);
    const res = await this.trackLatency(context.tracker, origin, () =>
      safeCall(() => method(context.payload)),
    );
    if (!res.success && this.errorTracking) {
      context.tracker.error(origin);
    }
    return { origin, ...res };
  }

  private async trackLatency<TResult>(
    tracker: LDMigrationTracker,
    origin: LDMigrationOrigin,
    method: () => Promise<TResult>,
  ): Promise<TResult> {
    if (!this.latencyTracking) {
      return method();
    }
    let start;
    let end;
    let result: TResult;
    // TODO: Need to validate performance existence check with edge SDKs.
    if (typeof performance !== undefined) {
      start = performance.now();
      result = await method();
      end = performance.now();
    }
    start = Date.now();
    result = await method();
    end = Date.now();

    // Performance timer is in ms, but may have a microsecond resolution
    // fractional component.
    const latency = end - start;
    tracker.latency(origin, latency);
    return result;
  }
}
