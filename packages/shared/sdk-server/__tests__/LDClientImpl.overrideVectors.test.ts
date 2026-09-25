import * as fs from 'fs';
import * as path from 'path';

import { expandFlagValue } from '../src/data_sources/filedata';
import {
  fdv2FullPayload,
  makeFDv2Client,
  makeFDv2Platform,
} from './overrides/overridesTestSupport';
import TestOverrideSource from './overrides/TestOverrideSource';

// These vectors come from the OVERRIDE specification. Each vector sets up LaunchDarkly data, an
// override layer, and an initialization state. The test evaluates one flag through the full
// client stack and checks the value, the variation index, and the reason.
const vectorsPath = path.join(__dirname, 'overrides', 'override-vectors', 'vectors.json');

// The vectors' semantics are versioned. A schema change means this runner needs review.
const supportedVectorSchema = '0.4.0';

interface OverrideVector {
  description: string;
  group: string;
  launchDarklyData: {
    initialized: boolean;
    flags: Record<string, any>;
    segments: Record<string, any>;
  };
  overrides: {
    flags?: Record<string, any>;
    flagValues?: Record<string, any>;
    segments?: Record<string, any>;
  };
  evaluate: {
    flagKey: string;
    context: any;
    defaultValue: any;
  };
  expect: {
    value: any;
    variationIndex: number | null;
    reason: Record<string, any>;
    summaryOverrideAffected?: boolean;
  };
}

const file: { schemaVersion: string; vectors: OverrideVector[] } = JSON.parse(
  fs.readFileSync(vectorsPath, 'utf8'),
);

it('uses the supported vector schema', () => {
  expect(file.schemaVersion).toEqual(supportedVectorSchema);
  expect(file.vectors.length).toBeGreaterThan(0);
});

describe.each(
  file.vectors.map((vector) => [`${vector.group}: ${vector.description}`, vector] as const),
)('%s', (_name, vector) => {
  it('evaluates as the vector expects', async () => {
    // The override layer is the same document shape the file-based source accepts. Flag value
    // entries expand into full flags the same way.
    const source = new TestOverrideSource({
      flags: [
        ...Object.values(vector.overrides.flags ?? {}),
        ...Object.entries(vector.overrides.flagValues ?? {}).map(([key, value]) =>
          expandFlagValue(key, value),
        ),
      ],
      segments: Object.values(vector.overrides.segments ?? {}),
    });
    const platform = vector.launchDarklyData.initialized
      ? makeFDv2Platform(
          fdv2FullPayload(vector.launchDarklyData.flags, vector.launchDarklyData.segments),
        )
      : makeFDv2Platform();
    const client = makeFDv2Client(platform, { dataSystem: { overrides: source } });
    try {
      if (vector.launchDarklyData.initialized) {
        await client.waitForInitialization({ timeout: 5 });
      }

      const detail = await client.variationDetail(
        vector.evaluate.flagKey,
        vector.evaluate.context,
        vector.evaluate.defaultValue,
      );

      expect(detail.value).toEqual(vector.expect.value);
      if (vector.expect.variationIndex === null) {
        expect(detail.variationIndex ?? null).toBeNull();
      } else {
        expect(detail.variationIndex).toEqual(vector.expect.variationIndex);
      }

      // The reason is compared only on the fields the vector lists. The override indicator
      // collapses tri-state: an expected reason that omits it requires the actual reason to
      // report false or to omit it.
      const actualReason = detail.reason as Record<string, any>;
      Object.entries(vector.expect.reason).forEach(([field, expected]) => {
        expect(actualReason[field]).toEqual(expected);
      });
      if (!('overrideAffected' in vector.expect.reason)) {
        expect(actualReason.overrideAffected ?? false).toBe(false);
      }
    } finally {
      client.close();
    }
  });
});
