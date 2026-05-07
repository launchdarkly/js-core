import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line import/no-extraneous-dependencies
import express from 'express';

// eslint-disable-next-line import/no-extraneous-dependencies
import { init, LDContext } from '@launchdarkly/node-server-sdk';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY ?? '';
const port = Number(process.env.PORT ?? 3001);

if (!sdkKey) {
  // eslint-disable-next-line no-console
  console.error('LAUNCHDARKLY_SDK_KEY must be set. See .env.example.');
  process.exit(1);
}

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const ldClient = init(sdkKey);

async function main() {
  await ldClient.waitForInitialization({ timeout: 10 });

  const app = express();

  app.get('/api/bootstrap', async (_req, res) => {
    const state = await ldClient.allFlagsState(context, { clientSideOnly: true });
    res.json(state.toJSON());
  });

  const dir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(dir, '..', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Bootstrap example server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Server failed to start:', err);
  process.exit(1);
});
