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

async function readSequentialRandom<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  // This number is not used for a purpose requiring cryptographic security.
  const randomIndex = Math.floor(Math.random() * 2);

  // Effectively flip a coin and do it on one order or the other.
  if (randomIndex === 0) {
    const fromOld = await safeCall(() => config.readOld());
    const fromNew = await safeCall(() => config.readNew());
    return { fromOld, fromNew };
  }
  const fromNew = await safeCall(() => config.readNew());
  const fromOld = await safeCall(() => config.readOld());
  return { fromOld, fromNew };
}

async function readSequentialFixed<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOld = await safeCall(() => config.readOld());
  const fromNew = await safeCall(() => config.readNew());
  return { fromOld, fromNew };
}

async function readConcurrent<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOldPromise = safeCall(() => config.readOld());
  const fromNewPromise = safeCall(() => config.readNew());

  const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

  return { fromOld, fromNew };
}

async function read<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>,
  execution: LDSerialExecution | LDConcurrentExecution
): Promise<MultipleReadResult<TMigrationRead>> {
  if (execution.type === LDExecution.Serial) {
    const serial = execution as LDSerialExecution;
    if (serial.ordering === LDExecutionOrdering.Fixed) {
      return readSequentialFixed(config);
    }
    return readSequentialRandom(config);
  }
  return readConcurrent(config);
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

export default class Migration<TMigrationRead, TMigrationWrite>
  implements LDMigration<TMigrationRead, TMigrationWrite>
{
  private readonly execution: LDSerialExecution | LDConcurrentExecution;

  private readonly readTable: {
    [index: string]: (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => Promise<LDMigrationReadResult<TMigrationRead>>;
  } = {
    [LDMigrationStage.Off]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'old', ...(await safeCall(() => config.readOld())) }),
    [LDMigrationStage.DualWrite]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'old', ...(await safeCall(() => config.readOld())) }),
    [LDMigrationStage.Shadow]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const { fromOld, fromNew } = await read<TMigrationRead, TMigrationWrite>(
        config,
        this.execution
      );

      this.trackConsistency(fromOld, fromNew);

      return { origin: 'old', ...fromOld };
    },
    [LDMigrationStage.Live]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const { fromOld, fromNew } = await read<TMigrationRead, TMigrationWrite>(
        config,
        this.execution
      );

      this.trackConsistency(fromOld, fromNew);

      return { origin: 'new', ...fromNew };
    },
    [LDMigrationStage.RampDown]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'new', ...(await safeCall(() => config.readNew())) }),
    [LDMigrationStage.Complete]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'new', ...(await safeCall(() => config.readNew())) }),
  };

  private readonly writeTable: {
    [index: string]: (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => Promise<LDMigrationWriteResult<TMigrationWrite>>;
  } = {
    [LDMigrationStage.Off]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ authoritative: { origin: 'old', ...(await safeCall(() => config.writeOld())) } }),
    [LDMigrationStage.DualWrite]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromOld = await safeCall(() => config.writeOld());
      if (!fromOld.success) {
        return {
          authoritative: { origin: 'old', ...fromOld },
        };
      }

      const fromNew = await safeCall(() => config.writeNew());

      return {
        authoritative: { origin: 'old', ...fromOld },
        nonAuthoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Shadow]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromOld = await safeCall(() => config.writeOld());
      if (!fromOld.success) {
        return {
          authoritative: { origin: 'old', ...fromOld },
        };
      }

      const fromNew = await safeCall(() => config.writeNew());

      return {
        authoritative: { origin: 'old', ...fromOld },
        nonAuthoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Live]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromNew = await safeCall(() => config.writeNew());
      if (!fromNew.success) {
        return { authoritative: { origin: 'new', ...fromNew } };
      }

      const fromOld = await safeCall(() => config.writeOld());

      return {
        nonAuthoritative: { origin: 'old', ...fromOld },
        authoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.RampDown]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromNew = await safeCall(() => config.writeNew());
      if (!fromNew.success) {
        return { authoritative: { origin: 'new', ...fromNew } };
      }

      const fromOld = await safeCall(() => config.writeOld());

      return {
        nonAuthoritative: { origin: 'old', ...fromOld },
        authoritative: { origin: 'new', ...fromNew },
      };
    },
    [LDMigrationStage.Complete]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ authoritative: { origin: 'new', ...(await safeCall(() => config.writeNew())) } }),
  };

  constructor(
    private readonly client: LDClient,
    private readonly tracker: LDMigrationTracker,
    private readonly config:
      | LDMigrationOptions<TMigrationRead, TMigrationWrite>
      | LDMigrationOptions<TMigrationRead, TMigrationWrite>
  ) {
    if (config.execution) {
      this.execution = config.execution;
    } else {
      this.execution = new LDConcurrentExecution();
    }
  }

  async read(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage
  ): Promise<LDMigrationReadResult<TMigrationRead>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.readTable[stage.value](this.config);
    this.trackReadError(res);
    return res;
  }

  async write(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage
  ): Promise<LDMigrationWriteResult<TMigrationWrite>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.writeTable[stage.value](this.config);
    this.trackWriteError(res);
    return res;
  }

  private trackReadError(res: LDMigrationReadResult<TMigrationRead>) {
    if (!res.success && this.config.errorTracking) {
      this.tracker.error(res.origin);
    }
  }

  private trackWriteError(res: LDMigrationWriteResult<TMigrationWrite>) {
    if (!res.authoritative.success) {
      this.tracker.error(res.authoritative.origin);
    }
    if (res.nonAuthoritative && !res.nonAuthoritative.success) {
      this.tracker.error(res.nonAuthoritative.origin);
    }
  }

  private trackConsistency(
    oldValue: LDMethodResult<TMigrationRead>,
    newValue: LDMethodResult<TMigrationRead>
  ) {
    if (this.config.check) {
      if (oldValue.success && newValue.success) {
        const res = this.config.check(oldValue.result, newValue.result);
        this.tracker.consistency(
          res ? LDConsistencyCheck.Consistent : LDConsistencyCheck.Inconsistent
        );
      }
    }
  }
}
