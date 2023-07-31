import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDClient, LDConsistencyCheck, LDMigrationStage, LDMigrationTracker } from './api';
import {
  LDMigrationOptions,
  LDSerialExecution,
  LDConcurrentExecution,
  LDExecution,
  LDExecutionOrdering,
  LDMethodResult,
} from './api/options/LDMigrationOptions';
import {
  LDMigration,
  LDMigrationOrigin,
  LDMigrationReadResult,
  LDMigrationWriteResult,
} from './api/LDMigration';

type MultipleReadResult<TMigrationRead> = {
  fromOld: LDMethodResult<TMigrationRead>;
  fromNew: LDMethodResult<TMigrationRead>;
};

async function safeCall<TResult>(
  method: () => Promise<LDMethodResult<TResult>>
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

export function LDMigrationSuccess<TResult>(result: TResult): LDMethodResult<TResult> {
  return {
    success: true,
    result,
  };
}

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

export default class Migration<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput = any,
  TMigrationWriteInput = any
> implements
    LDMigration<TMigrationRead, TMigrationWrite, TMigrationReadInput, TMigrationWriteInput>
{
  private readonly execution: LDSerialExecution | LDConcurrentExecution;

  private readonly readTable: {
    [index: string]: (
      context: MigrationContext<TMigrationReadInput>
    ) => Promise<LDMigrationReadResult<TMigrationRead>>;
  } = {
    [LDMigrationStage.Off]: async (context) => ({
      origin: 'old',
      ...(await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.readOld(context.payload))
      )),
    }),
    [LDMigrationStage.DualWrite]: async (context) => ({
      origin: 'old',
      ...(await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.readOld(context.payload))
      )),
    }),
    [LDMigrationStage.Shadow]: async (context) => {
      const { fromOld, fromNew } = await this.doRead(context);

      this.trackConsistency(context.tracker, fromOld, fromNew);

      return { origin: 'old', ...fromOld };
    },
    [LDMigrationStage.Live]: async (context) => {
      const { fromNew, fromOld } = await this.doRead(context);

      this.trackConsistency(context.tracker, fromOld, fromNew);

      return { origin: 'new', ...fromNew };
    },
    [LDMigrationStage.RampDown]: async (context) => ({
      origin: 'new',
      ...(await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.readNew(context.payload))
      )),
    }),
    [LDMigrationStage.Complete]: async (context) => ({
      origin: 'new',
      ...(await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.readNew(context.payload))
      )),
    }),
  };

  private readonly writeTable: {
    [index: string]: (
      context: MigrationContext<TMigrationWriteInput>
    ) => Promise<LDMigrationWriteResult<TMigrationWrite>>;
  } = {
    [LDMigrationStage.Off]: async (context) => ({
      authoritative: {
        origin: 'old',
        ...(await this.trackLatency(context.tracker, 'old', () =>
          safeCall(() => this.config.writeOld(context.payload))
        )),
      },
    }),
    [LDMigrationStage.DualWrite]: async (context) => {
      const fromOld = await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.writeOld(context.payload))
      );
      if (!fromOld.success) {
        return {
          authoritative: { origin: 'old', ...fromOld },
        };
      }

      const fromNew = await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.writeNew(context.payload))
      );

      return {
        authoritative: { origin: 'old', ...fromOld },
        nonAuthoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Shadow]: async (context) => {
      const fromOld = await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.writeOld(context.payload))
      );
      if (!fromOld.success) {
        return {
          authoritative: { origin: 'old', ...fromOld },
        };
      }

      const fromNew = await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.writeNew(context.payload))
      );

      return {
        authoritative: { origin: 'old', ...fromOld },
        nonAuthoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Live]: async (context) => {
      const fromNew = await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.writeNew(context.payload))
      );
      if (!fromNew.success) {
        return { authoritative: { origin: 'new', ...fromNew } };
      }

      const fromOld = await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.writeOld(context.payload))
      );

      return {
        nonAuthoritative: { origin: 'old', ...fromOld },
        authoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.RampDown]: async (context) => {
      const fromNew = await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.writeNew(context.payload))
      );
      if (!fromNew.success) {
        return { authoritative: { origin: 'new', ...fromNew } };
      }

      const fromOld = await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.writeOld(context.payload))
      );

      return {
        nonAuthoritative: { origin: 'old', ...fromOld },
        authoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Complete]: async (context) => ({
      authoritative: {
        origin: 'new',
        ...(await this.trackLatency(context.tracker, 'new', () =>
          safeCall(() => this.config.writeNew(context.payload))
        )),
      },
    }),
  };

  constructor(
    private readonly client: LDClient,
    private readonly config: LDMigrationOptions<
      TMigrationRead,
      TMigrationWrite,
      TMigrationReadInput,
      TMigrationWriteInput
    >
  ) {
    if (this.config.execution) {
      this.execution = this.config.execution;
    } else {
      this.execution = new LDConcurrentExecution();
    }
  }

  async read(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationReadInput
  ): Promise<LDMigrationReadResult<TMigrationRead>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.readTable[stage.value]({
      payload,
      tracker: stage.tracker,
    });
    stage.tracker.op('read');
    this.trackReadError(stage.tracker, res);
    this.sendEvent(stage.tracker);
    return res;
  }

  async write(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationWriteInput
  ): Promise<LDMigrationWriteResult<TMigrationWrite>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.writeTable[stage.value]({
      payload,
      tracker: stage.tracker,
    });
    stage.tracker.op('write');
    this.trackWriteError(stage.tracker, res);
    this.sendEvent(stage.tracker);
    return res;
  }

  private sendEvent(tracker: LDMigrationTracker) {
    const event = tracker.createEvent();
    if (event) {
      this.client.trackMigration(event);
    }
  }

  private trackReadError(tracker: LDMigrationTracker, res: LDMigrationReadResult<TMigrationRead>) {
    if (!res.success && this.config.errorTracking) {
      tracker.error(res.origin);
    }
  }

  private trackWriteError(
    tracker: LDMigrationTracker,
    res: LDMigrationWriteResult<TMigrationWrite>
  ) {
    if (!res.authoritative.success) {
      tracker.error(res.authoritative.origin);
    }
    if (res.nonAuthoritative && !res.nonAuthoritative.success) {
      tracker.error(res.nonAuthoritative.origin);
    }
  }

  private trackConsistency(
    tracker: LDMigrationTracker,
    oldValue: LDMethodResult<TMigrationRead>,
    newValue: LDMethodResult<TMigrationRead>
  ) {
    if (this.config.check) {
      if (oldValue.success && newValue.success) {
        const res = this.config.check(oldValue.result, newValue.result);
        tracker.consistency(res ? LDConsistencyCheck.Consistent : LDConsistencyCheck.Inconsistent);
      }
    }
  }

  private async readSequentialFixed(
    context: MigrationContext<TMigrationReadInput>
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOld = await this.trackLatency(context.tracker, 'old', () =>
      safeCall(() => this.config.readOld(context.payload))
    );
    const fromNew = await this.trackLatency(context.tracker, 'new', () =>
      safeCall(() => this.config.readNew(context.payload))
    );
    return { fromOld, fromNew };
  }

  private async readConcurrent(
    context: MigrationContext<TMigrationReadInput>
  ): Promise<MultipleReadResult<TMigrationRead>> {
    const fromOldPromise = this.trackLatency(context.tracker, 'old', () =>
      safeCall(() => this.config.readOld(context.payload))
    );
    const fromNewPromise = this.trackLatency(context.tracker, 'new', () =>
      safeCall(() => this.config.readNew(context.payload))
    );

    const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

    return { fromOld, fromNew };
  }

  private async readSequentialRandom(
    context: MigrationContext<TMigrationReadInput>
  ): Promise<MultipleReadResult<TMigrationRead>> {
    // This number is not used for a purpose requiring cryptographic security.
    const randomIndex = Math.floor(Math.random() * 2);

    // Effectively flip a coin and do it on one order or the other.
    if (randomIndex === 0) {
      const fromOld = await this.trackLatency(context.tracker, 'old', () =>
        safeCall(() => this.config.readOld(context.payload))
      );
      const fromNew = await this.trackLatency(context.tracker, 'new', () =>
        safeCall(() => this.config.readNew(context.payload))
      );
      return { fromOld, fromNew };
    }
    const fromNew = await this.trackLatency(context.tracker, 'new', () =>
      safeCall(() => this.config.readNew(context.payload))
    );
    const fromOld = await this.trackLatency(context.tracker, 'old', () =>
      safeCall(() => this.config.readOld(context.payload))
    );
    return { fromOld, fromNew };
  }

  private async doRead(
    context: MigrationContext<TMigrationReadInput>
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

  private async trackLatency<TResult>(
    tracker: LDMigrationTracker,
    origin: LDMigrationOrigin,
    method: () => Promise<TResult>
  ): Promise<TResult> {
    if (!this.config.latencyTracking) {
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
    const latency = Math.floor(end - start);
    tracker.latency(origin, latency);
    return result;
  }
}
