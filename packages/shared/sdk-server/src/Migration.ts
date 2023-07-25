import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDClient, LDMigrationStage } from './api';
import {
  LDMigrationOptions,
  LDSerialExecution,
  LDConcurrentExecution,
  LDExecution,
  LDExecutionOrdering,
  LDMethodResult,
} from './api/options/LDMigrationOptions';
import { LDMigration, LDMigrationResult } from './api/LDMigration';

type MultipleReadResult<TMigrationRead> = {
  fromOld?: LDMethodResult<TMigrationRead>;
  fromNew?: LDMethodResult<TMigrationRead>;
};

async function readSequentialRandom<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  // This number is not used for a purpose requiring cryptographic security.
  const randomIndex = Math.floor(Math.random() * 2);

  // Effectively flip a coin and do it on one order or the other.
  if (randomIndex === 0) {
    const fromOld = await config.readOld();
    const fromNew = await config.readNew();
    return { fromOld, fromNew };
  }
  const fromNew = await config.readNew();
  const fromOld = await config.readOld();
  return { fromOld, fromNew };
}

async function readSequentialFixed<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOld = await config.readOld();
  const fromNew = await config.readNew();
  return { fromOld, fromNew };
}

async function readConcurrent<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
): Promise<MultipleReadResult<TMigrationRead>> {
  const fromOldPromise = config.readOld();
  const fromNewPromise = config.readNew();

  const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

  return { fromOld, fromNew };
}

async function read<TMigrationRead, TMigrationWrite>(
  config: LDMigrationOptions<TMigrationRead, TMigrationWrite>,
  execution: LDSerialExecution | LDConcurrentExecution
): Promise<{ fromOld?: LDMethodResult<TMigrationRead>; fromNew?: LDMethodResult<TMigrationRead> }> {
  if (execution.type === LDExecution.Serial) {
    const serial = execution as LDSerialExecution;
    if (serial.ordering === LDExecutionOrdering.Fixed) {
      return readSequentialFixed<TMigrationRead, TMigrationWrite>(config);
    }
    return readSequentialRandom<TMigrationRead, TMigrationWrite>(config);
  }
  return readConcurrent<TMigrationRead, TMigrationWrite>(config);
}

export default class Migration<TMigrationRead, TMigrationWrite>
  implements LDMigration<TMigrationRead, TMigrationWrite>
{
  private readonly execution: LDSerialExecution | LDConcurrentExecution;

  private readonly readTable: {
    [index: string]: (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => Promise<LDMigrationResult<TMigrationRead>>;
  } = {
    [LDMigrationStage.Off]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'old', ...(await config.readOld()) }),
    [LDMigrationStage.DualWrite]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'old', ...(await config.readOld()) }),
    [LDMigrationStage.Shadow]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const { fromOld } = await read<TMigrationRead, TMigrationWrite>(config, this.execution);

      // TODO: Consistency check.

      return { origin: 'old', ...fromOld };
    },
    [LDMigrationStage.Live]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const { fromNew } = await read<TMigrationRead, TMigrationWrite>(config, this.execution);

      // TODO: Consistency check.

      return { origin: 'new', ...fromNew };
    },
    [LDMigrationStage.RampDown]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'new', ...(await config.readNew()) }),
    [LDMigrationStage.Complete]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'new', ...(await config.readNew()) }),
  };

  private readonly writeTable: {
    [index: string]: (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => Promise<LDMigrationResult<TMigrationWrite>>;
  } = {
    [LDMigrationStage.Off]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'old', ...(await config.writeOld()) }),
    [LDMigrationStage.DualWrite]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromOld = await config.writeOld();
      if (!fromOld.error) {
        await config.writeNew();
      }

      return { origin: 'old', ...fromOld };
    },
    [LDMigrationStage.Shadow]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromOld = await config.writeOld();
      if (!fromOld.error) {
        await config.writeNew();
      }

      return { origin: 'old', ...fromOld };
    },
    [LDMigrationStage.Live]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromNew = await config.writeNew();
      if (!fromNew.error) {
        await config.writeOld();
      }
      return { origin: 'new', ...fromNew };
    },
    [LDMigrationStage.RampDown]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => {
      const fromNew = await config.writeNew();
      if (!fromNew.error) {
        await config.writeOld();
      }
      return { origin: 'new', ...fromNew };
    },
    [LDMigrationStage.Complete]: async (
      config: LDMigrationOptions<TMigrationRead, TMigrationWrite>
    ) => ({ origin: 'new', ...(await config.writeNew()) }),
  };

  constructor(
    private readonly client: LDClient,
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
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationRead>> {
    const stage = await this.client.variationMigration(key, context, defaultValue);
    return this.readTable[stage](this.config);
  }

  async write(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationWrite>> {
    const stage = await this.client.variationMigration(key, context, defaultValue);

    return this.writeTable[stage](this.config);
  }
}
