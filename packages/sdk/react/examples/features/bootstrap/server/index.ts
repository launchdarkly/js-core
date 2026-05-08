import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line import/no-extraneous-dependencies
import express from 'express';

// eslint-disable-next-line import/no-extraneous-dependencies
import { init, LDContext } from '@launchdarkly/node-server-sdk';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY ?? '';
const clientSideId = process.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';
const port = Number(process.env.PORT ?? 3001);

if (!sdkKey || !clientSideId) {
  // eslint-disable-next-line no-console
  console.error(
    'LAUNCHDARKLY_SDK_KEY and LAUNCHDARKLY_CLIENT_SIDE_ID must be set. See .env.example.',
  );
  process.exit(1);
}

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// JSON-encode for embedding inside a `<script>` tag. Escape `<` so the value can never close
// the script tag, even if a flag value happens to contain `</script>`.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const ldClient = init(sdkKey);

async function main() {
  await ldClient.waitForInitialization({ timeout: 10 });

  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(dir, '..', 'dist');

  app.set('view engine', 'ejs');
  app.set('views', path.resolve(dir, '..', 'views'));

  app.use('/assets', express.static(path.join(distDir, 'assets')));

  app.get('/', async (_req, res) => {
    const state = await ldClient.allFlagsState(context, { clientSideOnly: true });
    res.render('index', {
      bootstrap: jsonForScript(state.toJSON()),
      clientSideId: jsonForScript(clientSideId),
      context: jsonForScript(context),
    });
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
