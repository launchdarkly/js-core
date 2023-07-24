import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDClient, LDMigrationStage } from '../api';
import { LDReadonlyMigrationOptions, LDMigrationOptions, LDSerialExecution, LDConcurrentExecution, LDExecution, LDExecutionOrdering } from '../api/options/LDMigrationOptions';

async function readSequentialRandom<TMigration>(config: LDReadonlyMigrationOptions<TMigration>):
  Promise<{ fromOld: TMigration; fromNew: TMigration; }> {
  // This number is not used for a purpose requiring cryptographic security.
  const randomIndex = Math.floor(Math.random() * 2);

  // Effectively flip a coin and do it on one order or the other.
  if (randomIndex == 0) {
    const fromOld = await config.readOld();
    const fromNew = await config.readNew();
    return { fromOld, fromNew };
  } else {
    const fromNew = await config.readNew();
    const fromOld = await config.readOld();
    return { fromOld, fromNew };
  }
}

async function readSequentialFixed<TMigration>(config: LDReadonlyMigrationOptions<TMigration>):
  Promise<{ fromOld: TMigration; fromNew: TMigration; }> {
  const fromOld = await config.readOld();
  const fromNew = await config.readNew();
  return { fromOld, fromNew };
}

async function readConcurrent<TMigration>(config: LDReadonlyMigrationOptions<TMigration>):
  Promise<{ fromOld: TMigration; fromNew: TMigration; }> {
  const fromOldPromise = config.readOld();
  const fromNewPromise = config.readNew();

  const [fromOld, fromNew] = await Promise.all([fromOldPromise, fromNewPromise]);

  return { fromOld, fromNew };
}

async function read<TMigration>(config: LDReadonlyMigrationOptions<TMigration>,
  execution: LDSerialExecution | LDConcurrentExecution):
  Promise<{ fromOld: TMigration; fromNew: TMigration; }> {
  if (execution.type === LDExecution.Serial) {
    const serial = execution as LDSerialExecution;
    if (serial.ordering === LDExecutionOrdering.Fixed) {
      return readSequentialFixed<TMigration>(config);
    }
    return readSequentialRandom<TMigration>(config);
  }
  return readConcurrent<TMigration>(config);
}


export default class Migration<TMigration> {
  private readonly execution: LDSerialExecution | LDConcurrentExecution;
  private readonly readTable = {
    [LDMigrationStage.Off]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      return config.readOld();
    },
    [LDMigrationStage.DualWrite]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      return config.readOld();
    },
    [LDMigrationStage.Shadow]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      const { fromOld, fromNew } = await read<TMigration>(config, this.execution);

      // TODO: Compare.

      return fromOld;
    },
    [LDMigrationStage.Live]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      const { fromOld, fromNew } = await read<TMigration>(config, this.execution);

      // TODO: Compare.

      return fromNew;
    },
    [LDMigrationStage.RampDown]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      return config.readNew();
    },
    [LDMigrationStage.Complete]: async (config: LDReadonlyMigrationOptions<TMigration>) => {
      return config.readNew();
    }
  };

  private readonly writeTable = {
    [LDMigrationStage.Off]: async (config: LDMigrationOptions<TMigration>) => {
      return config.writeOld();
    },
    [LDMigrationStage.DualWrite]: async (config: LDMigrationOptions<TMigration>) => {
      const fromOld = await config.writeOld();
      await config.writeNew();
      return fromOld;
    },
    [LDMigrationStage.Shadow]: async (config: LDMigrationOptions<TMigration>) => {
      const fromOld = await config.writeOld();
      await config.writeNew();
      return fromOld;
    },
    [LDMigrationStage.Live]: async (config: LDMigrationOptions<TMigration>) => {
      const fromNew = await config.writeNew();
      await config.writeOld();
      return fromNew;
    },
    [LDMigrationStage.RampDown]: async (config: LDMigrationOptions<TMigration>) => {
      const fromNew = await config.writeNew();
      await config.writeOld();
      return fromNew;
    },
    [LDMigrationStage.Complete]: async (config: LDMigrationOptions<TMigration>) => {
      return config.writeNew();
    }
  };

  constructor(
    private readonly client: LDClient,
    private readonly config: LDMigrationOptions<TMigration> | LDReadonlyMigrationOptions<TMigration>) {
    if (config.execution) {
      this.execution = config.execution;
    } else {
      this.execution = new LDConcurrentExecution();
    }
  }

  async read(key: string, context: LDContext, defaultValue: LDMigrationStage): Promise<TMigration> {
    const stage = await this.client.variationMigration(key, context, defaultValue);
    return this.readTable[stage](this.config);
  }

  async write(key: string, context: LDContext, defaultValue: LDMigrationStage): Promise<TMigration> {
    const stage = await this.client.variationMigration(key, context, defaultValue);
    const fullConfig = this.config as LDMigrationOptions<TMigration>;
    if (fullConfig.writeOld === undefined || fullConfig.writeNew === undefined) {
      // TODO: What should we be doing here?
      throw new Error('Migration configuration does not support writing');
    }
    return this.writeTable[stage](this.config as LDMigrationOptions<TMigration>);
  }
}