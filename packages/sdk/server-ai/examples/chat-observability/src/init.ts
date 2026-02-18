/* eslint-disable no-console */
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OpenAIInstrumentation } from '@traceloop/instrumentation-openai';
import 'dotenv/config';

import { basicLogger, init } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const serviceName = process.env.SERVICE_NAME || 'hello-js-ai-observability';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  logger: basicLogger({ level: 'debug', destination: console.log }),
  plugins: [
    new Observability({
      serviceName,
      serviceVersion,
    }),
  ],
});

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation()],
});

export { ldClient };
