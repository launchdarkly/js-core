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

async function readSequentialRandom<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput,
  TMigrationWriteInput
>(
  config: LDMigrationOptions<
    TMigrationRead,
    TMigrationWrite,
    TMigrationReadInput,
    TMigrationWriteInput
  >,
  payload?: TMigrationReadInput
): Promise<MultipleReadResult<TMigrationRead>> {
  // This number is not used for a purpose requiring cryptographic security.
  const randomIndex = Math.floor(Math.random() * 2);

  // Effectively flip a coin and do it on one order or the other.
  if (randomIndex === 0) {
    const fromOld = await safeCall(() => config.readOld(payload));
    const fromNew = await safeCall(() => config.readNew(payload));
    return { fromOld, fromNew };
  }
  const fromNew = await safeCall(() => config.readNew(payload));
  const fromOld = await safeCall(() => config.readOld(payload));
  return { fromOld, fromNew };
}

async function readSequentialFixed<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput,
  TMigrationWriteInput
>(
  config: LDMigrationOptions<
    TMigrationRead,
    TMigrationWrite,
    TMigrationReadInput,
    TMigrationWriteInput
  >,
  payload?: TMigrationReadInput
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOld = await safeCall(() => config.readOld(payload));
  const fromNew = await safeCall(() => config.readNew(payload));
  return { fromOld, fromNew };
}

async function readConcurrent<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput,
  TMigrationWriteInput
>(
  config: LDMigrationOptions<
    TMigrationRead,
    TMigrationWrite,
    TMigrationReadInput,
    TMigrationWriteInput
  >,
  payload?: TMigrationReadInput
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOldPromise = safeCall(() => config.readOld(payload));
  const fromNewPromise = safeCall(() => config.readNew(payload));

  const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

  return { fromOld, fromNew };
}

async function read<TMigrationRead, TMigrationWrite, TMigrationReadInput, TMigrationWriteInput>(
  config: LDMigrationOptions<
    TMigrationRead,
    TMigrationWrite,
    TMigrationReadInput,
    TMigrationWriteInput
  >,
  execution: LDSerialExecution | LDConcurrentExecution,
  payload?: TMigrationReadInput
): Promise<MultipleReadResult<TMigrationRead>> {
  if (execution.type === LDExecution.Serial) {
    const serial = execution as LDSerialExecution;
    if (serial.ordering === LDExecutionOrdering.Fixed) {
      return readSequentialFixed(config, payload);
    }
    return readSequentialRandom(config, payload);
  }
  return readConcurrent(config, payload);
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
      config: LDMigrationOptions<
        TMigrationRead,
        TMigrationWrite,
        TMigrationReadInput,
        TMigrationWriteInput
      >,
      payload?: TMigrationReadInput
    ) => Promise<LDMigrationReadResult<TMigrationRead>>;
  } = {
      [LDMigrationStage.Off]: async (config, payload) => ({
        origin: 'old',
        ...(await safeCall(() => config.readOld(payload))),
      }),
      [LDMigrationStage.DualWrite]: async (config, payload) => ({
        origin: 'old',
        ...(await safeCall(() => config.readOld(payload))),
      }),
      [LDMigrationStage.Shadow]: async (config, payload) => {
        const { fromOld, fromNew } = await read(config, this.execution, payload);

        this.trackConsistency(fromOld, fromNew);

        return { origin: 'old', ...fromOld };
      },
      [LDMigrationStage.Live]: async (config, payload) => {
        const { fromNew, fromOld } = await read(config, this.execution, payload);

        this.trackConsistency(fromOld, fromNew);

        return { origin: 'new', ...fromNew };
      },
      [LDMigrationStage.RampDown]: async (config, payload) => ({
        origin: 'new',
        ...(await safeCall(() => config.readNew(payload))),
      }),
      [LDMigrationStage.Complete]: async (config, payload) => ({
        origin: 'new',
        ...(await safeCall(() => config.readNew(payload))),
      }),
    };

  private readonly writeTable: {
    [index: string]: (
      config: LDMigrationOptions<
        TMigrationRead,
        TMigrationWrite,
        TMigrationReadInput,
        TMigrationWriteInput
      >,
      payload?: TMigrationWriteInput
    ) => Promise<LDMigrationWriteResult<TMigrationWrite>>;
  } = {
      [LDMigrationStage.Off]: async (config, payload) => ({
        authoritative: { origin: 'old', ...(await safeCall(() => config.writeOld(payload))) },
      }),
      [LDMigrationStage.DualWrite]: async (config, payload) => {
        const fromOld = await safeCall(() => config.writeOld(payload));
        if (!fromOld.success) {
          return {
            authoritative: { origin: 'old', ...fromOld },
          };
        }

        const fromNew = await safeCall(() => config.writeNew(payload));

        return {
          authoritative: { origin: 'old', ...fromOld },
          nonAuthoritative: { origin: 'new', ...fromNew },
        };
      },
      [LDMigrationStage.Shadow]: async (config, payload) => {
        const fromOld = await safeCall(() => config.writeOld(payload));
        if (!fromOld.success) {
          return {
            authoritative: { origin: 'old', ...fromOld },
          };
        }

        const fromNew = await safeCall(() => config.writeNew(payload));

        return {
          authoritative: { origin: 'old', ...fromOld },
          nonAuthoritative: { origin: 'new', ...fromNew },
        };
      },
      [LDMigrationStage.Live]: async (config, payload) => {
        const fromNew = await safeCall(() => config.writeNew(payload));
        if (!fromNew.success) {
          return { authoritative: { origin: 'new', ...fromNew } };
        }

        const fromOld = await safeCall(() => config.writeOld(payload));

        return {
          nonAuthoritative: { origin: 'old', ...fromOld },
          authoritative: { origin: 'new', ...fromNew },
        };
      },
      [LDMigrationStage.RampDown]: async (config, payload) => {
        const fromNew = await safeCall(() => config.writeNew(payload));
        if (!fromNew.success) {
          return { authoritative: { origin: 'new', ...fromNew } };
        }

        const fromOld = await safeCall(() => config.writeOld(payload));

        return {
          nonAuthoritative: { origin: 'old', ...fromOld },
          authoritative: { origin: 'new', ...fromNew },
        };
      },
      [LDMigrationStage.Complete]: async (config, payload) => ({
        authoritative: { origin: 'new', ...(await safeCall(() => config.writeNew(payload))) },
      }),
    };

  constructor(
    private readonly client: LDClient,
    private readonly tracker: LDMigrationTracker,
    private readonly config: LDMigrationOptions<
      TMigrationRead,
      TMigrationWrite,
      TMigrationReadInput,
      TMigrationWriteInput
    >
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
    defaultStage: LDMigrationStage,
    payload?: TMigrationReadInput
  ): Promise<LDMigrationReadResult<TMigrationRead>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.readTable[stage.value](this.config, payload);
    this.trackReadError(res);
    return res;
  }

  async write(
    key: string,
    context: LDContext,
    defaultStage: LDMigrationStage,
    payload?: TMigrationWriteInput
  ): Promise<LDMigrationWriteResult<TMigrationWrite>> {
    const stage = await this.client.variationMigration(key, context, defaultStage);
    const res = await this.writeTable[stage.value](this.config, payload);
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
