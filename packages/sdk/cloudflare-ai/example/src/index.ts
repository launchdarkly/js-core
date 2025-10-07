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
      const topic = url.searchParams.get('topic') || 'programming';
      const jokeType = url.searchParams.get('joke_type') || 'general';
      const topicSection = topic ? ` about ${topic}` : '';

      const ldClient = init(env.LD_CLIENT_ID, env.LD_KV, { sendEvents: true });
      await ldClient.waitForInitialization();

      // Pass KV namespace and client ID so AI SDK can read AI Configs directly
      const aiClient = initAi(ldClient, env.LD_CLIENT_ID, env.LD_KV);

      const context = {
        kind: 'user',
        key: userId,
      };

      const config = await aiClient.config(
        'joke-ai-config',
        context,
        {
          enabled: false,
        },
        { joke_type: jokeType, topic_section: topicSection },
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

      const response = await (config as any).runWithWorkersAI(env.AI);

      // Ensure events are flushed after the response is returned
      ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()));

      return new Response(
        JSON.stringify({
          success: true,
          userId,
          topic,
          model: config.model?.name,
          provider: config.provider?.name || 'cloudflare-workers-ai',
          joke: (response as any).response || response,
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
