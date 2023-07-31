import { LDClientImpl, LDMigrationStage } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import { LDClientCallbacks } from '../src/LDClientImpl';
import basicPlatform from './evaluation/mocks/platform';

/**
 * Basic callback handler that records errors for tests.
 */
export default function makeCallbacks(): [Error[], LDClientCallbacks] {
  const errors: Error[] = [];
  return [
    errors,
    {
      onError: (error) => {
        errors.push(error);
      },
      onFailed: () => {},
      onReady: () => {},
      onUpdate: () => {},
      hasEventListeners: () => true,
    },
  ];
}

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;
  let callbacks: LDClientCallbacks;
  let errors: Error[];

  beforeEach(async () => {
    td = new TestData();
    [errors, callbacks] = makeCallbacks();
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      callbacks,
    );

    await client.waitForInitialization();
  });

  afterEach(() => {
    client.close();
  });

  it.each(['off', 'dualwrite', 'shadow', 'live', 'rampdown', 'complete'])(
    'handles valid migration stages: %p',
    async (value) => {
      const flagKey = 'migration';
      td.update(td.flag(flagKey).valueForAll(value));
      // Get a default value that is not the value under test.
      const defaultValue = Object.values(LDMigrationStage).find((item) => item !== value);
      // Verify the pre-condition that the default value is not the value under test.
      expect(defaultValue).not.toEqual(value);
      const res = await client.variationMigration(
        flagKey,
        { key: 'test-key' },
        defaultValue as LDMigrationStage,
      );
      expect(res).toEqual(value);
    },
  );

  it.each([
    LDMigrationStage.Off,
    LDMigrationStage.DualWrite,
    LDMigrationStage.Shadow,
    LDMigrationStage.Live,
    LDMigrationStage.RampDown,
    LDMigrationStage.Complete,
  ])('returns the default value if the flag does not exist: default = %p', async (stage) => {
    const res = await client.variationMigration('no-flag', { key: 'test-key' }, stage);

    expect(res).toEqual(stage);
  });

  it('produces an error event for a migration flag with an incorrect value', async () => {
    const flagKey = 'bad-migration';
    td.update(td.flag(flagKey).valueForAll('potato'));
    const res = await client.variationMigration(flagKey, { key: 'test-key' }, LDMigrationStage.Off);
    expect(res).toEqual(LDMigrationStage.Off);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual(
      'Unrecognized MigrationState for "bad-migration"; returning default value.',
    );
  });

  it('includes an error in the node callback', (done) => {
    const flagKey = 'bad-migration';
    td.update(td.flag(flagKey).valueForAll('potato'));
    client.variationMigration(flagKey, { key: 'test-key' }, LDMigrationStage.Off, (err, value) => {
      const error = err as Error;
      expect(error.message).toEqual(
        'Unrecognized MigrationState for "bad-migration"; returning default value.',
      );
      expect(value).toEqual(LDMigrationStage.Off);
      done();
    });
  });
});
