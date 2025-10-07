import { init } from '@launchdarkly/cloudflare-server-sdk';
import { initAi } from '@launchdarkly/cloudflare-server-sdk-ai';

interface Env {
  LD_CLIENT_ID: string;
  LD_KV: KVNamespace;
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') || 'anonymous-user';

      const ldClient = init(env.LD_CLIENT_ID, env.LD_KV, { sendEvents: true });
      await ldClient.waitForInitialization();

      // Pass KV namespace and client ID so AI SDK can read AI Configs directly
      const aiClient = initAi(ldClient, { clientSideID: env.LD_CLIENT_ID, kvNamespace: env.LD_KV });

      const context = {
        kind: 'user',
        key: userId,
      };

      const config = await aiClient.config(
        'random-joke',
        context,
        {
          enabled: false,
        },
      );

      if (!config.enabled) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'AI feature is not enabled for this user',
            userId,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const wc = config.toWorkersAI(env.AI);
      // Workers AI bindings have many possible outputs; cast to a minimal type that includes optional usage.
      type WorkersAIResultWithUsage = { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number } } | unknown;
      const response = (await config.tracker.trackWorkersAIMetrics(() => env.AI.run(wc.model as any, wc as any))) as WorkersAIResultWithUsage;

      // Ensure events are flushed after the response is returned
      ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()));

      return new Response(
        JSON.stringify({
          success: true,
          userId,
          model: config.model?.name,
          provider: config.provider?.name || 'cloudflare-workers-ai',
          joke: (response as any)?.response || (response as any),
          enabled: config.enabled,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
