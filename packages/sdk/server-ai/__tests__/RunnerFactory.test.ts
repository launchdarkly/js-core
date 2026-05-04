import { LDAIConfigKind } from '../src/api/config/types';
import { AIProvider, ToolRegistry } from '../src/api/providers/AIProvider';
import { AgentGraphRunner, Runner } from '../src/api/providers/Runner';
import { RunnerFactory, SupportedAIProvider } from '../src/api/providers/RunnerFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeConfig = (providerName: string): LDAIConfigKind =>
  ({
    key: 'test-config',
    enabled: true,
    provider: { name: providerName },
    createTracker: () => ({}) as any,
    evaluator: {} as any,
  }) as unknown as LDAIConfigKind;

const makeRunner = (): Runner => ({ run: jest.fn() });
const makeGraphRunner = (): AgentGraphRunner => ({ run: jest.fn() });

// ---------------------------------------------------------------------------
// _getProvidersToTry (tested indirectly via createModel provider selection)
// ---------------------------------------------------------------------------

describe('RunnerFactory.createModel', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('returns undefined and logs a warning when no provider package is installed', async () => {
    const warnSpy = jest.fn();
    const logger = { warn: warnSpy, debug: jest.fn(), info: jest.fn(), error: jest.fn() };

    // Override dynamic import so every package throws MODULE_NOT_FOUND
    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(undefined);

    const result = await RunnerFactory.createModel(makeConfig('openai'), logger as any);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not supported'));
  });

  it('returns a Runner from the first provider that succeeds', async () => {
    const runner = makeRunner();
    const mockFactory: AIProvider = {
      createModel: jest.fn().mockResolvedValue(runner),
      createAgent: jest.fn().mockResolvedValue(undefined),
      createAgentGraph: jest.fn().mockResolvedValue(undefined),
    } as unknown as AIProvider;

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(mockFactory);

    const result = await RunnerFactory.createModel(makeConfig('openai'));

    expect(result).toBe(runner);
    expect(mockFactory.createModel).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('uses only the defaultAiProvider when one is specified', async () => {
    const runner = makeRunner();
    const mockFactory: AIProvider = {
      createModel: jest.fn().mockResolvedValue(runner),
    } as unknown as AIProvider;

    const getProviderSpy = jest
      .spyOn(RunnerFactory as any, '_getProviderFactory')
      .mockResolvedValue(mockFactory);

    await RunnerFactory.createModel(makeConfig('langchain'), undefined, 'openai' as SupportedAIProvider);

    // _getProviderFactory should only have been called once, with 'openai'
    expect(getProviderSpy).toHaveBeenCalledTimes(1);
    expect(getProviderSpy).toHaveBeenCalledWith('openai', undefined);
  });

  it('falls through to multi-provider packages when specific provider returns undefined', async () => {
    const runner = makeRunner();

    let callCount = 0;
    const getProviderSpy = jest
      .spyOn(RunnerFactory as any, '_getProviderFactory')
      .mockImplementation(async (providerType: string) => {
        callCount += 1;
        if (providerType === 'openai') {
          // openai package not installed
          return undefined;
        }
        // langchain succeeds
        return {
          createModel: jest.fn().mockResolvedValue(runner),
        } as unknown as AIProvider;
      });

    const result = await RunnerFactory.createModel(makeConfig('openai'));

    expect(result).toBe(runner);
    // Should have tried openai first, then langchain
    expect(getProviderSpy.mock.calls[0][0]).toBe('openai');
    expect(getProviderSpy.mock.calls[1][0]).toBe('langchain');
  });
});

// ---------------------------------------------------------------------------
// _withFallback behaviour
// ---------------------------------------------------------------------------

describe('RunnerFactory._withFallback', () => {
  it('returns the first truthy result and does not call remaining factories', async () => {
    const runner = makeRunner();
    const factoryA: AIProvider = {
      createModel: jest.fn().mockResolvedValue(runner),
    } as unknown as AIProvider;
    const factoryB: AIProvider = {
      createModel: jest.fn().mockResolvedValue(makeRunner()),
    } as unknown as AIProvider;

    jest
      .spyOn(RunnerFactory as any, '_getProviderFactory')
      .mockResolvedValueOnce(factoryA)
      .mockResolvedValueOnce(factoryB);

    const result = await RunnerFactory.createModel(makeConfig('openai'));

    expect(result).toBe(runner);
    // factoryB.createModel should never have been called
    expect(factoryB.createModel).not.toHaveBeenCalled();
  });

  it('returns undefined when all factories return undefined', async () => {
    const factoryA: AIProvider = {
      createModel: jest.fn().mockResolvedValue(undefined),
    } as unknown as AIProvider;

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(factoryA);

    const result = await RunnerFactory.createModel(makeConfig('openai'));

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createAgent
// ---------------------------------------------------------------------------

describe('RunnerFactory.createAgent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates to factory.createAgent with config and tools', async () => {
    const runner = makeRunner();
    const tools: ToolRegistry = { myTool: jest.fn() };
    const mockFactory: AIProvider = {
      createAgent: jest.fn().mockResolvedValue(runner),
    } as unknown as AIProvider;

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(mockFactory);

    const result = await RunnerFactory.createAgent(makeConfig('openai'), tools);

    expect(result).toBe(runner);
    expect(mockFactory.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
      tools,
    );
  });

  it('returns undefined and warns when no provider supports createAgent', async () => {
    const warnSpy = jest.fn();
    const logger = { warn: warnSpy, debug: jest.fn(), info: jest.fn(), error: jest.fn() };

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(undefined);

    const result = await RunnerFactory.createAgent(makeConfig('openai'), undefined, logger as any);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not supported'));
  });
});

// ---------------------------------------------------------------------------
// createAgentGraph
// ---------------------------------------------------------------------------

describe('RunnerFactory.createAgentGraph', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates to factory.createAgentGraph with graphDef and tools', async () => {
    const graphRunner = makeGraphRunner();
    const tools: ToolRegistry = { search: jest.fn() };
    const graphDef = {} as any; // AgentGraphDefinition shape not needed for this test

    const mockFactory: AIProvider = {
      createAgentGraph: jest.fn().mockResolvedValue(graphRunner),
    } as unknown as AIProvider;

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(mockFactory);

    const result = await RunnerFactory.createAgentGraph(graphDef, tools);

    expect(result).toBe(graphRunner);
    expect(mockFactory.createAgentGraph).toHaveBeenCalledWith(graphDef, tools);
  });

  it('returns undefined and warns when no provider supports createAgentGraph', async () => {
    const warnSpy = jest.fn();
    const logger = { warn: warnSpy, debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    const graphDef = {} as any;

    jest.spyOn(RunnerFactory as any, '_getProviderFactory').mockResolvedValue(undefined);

    const result = await RunnerFactory.createAgentGraph(
      graphDef,
      undefined,
      logger as any,
    );

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('AgentGraphRunner'));
  });
});

// ---------------------------------------------------------------------------
// AIProvider default factory method implementations
// ---------------------------------------------------------------------------

describe('AIProvider default factory methods', () => {
  class ConcreteProvider extends AIProvider {}

  it('createModel returns undefined by default', async () => {
    const provider = new ConcreteProvider();
    const result = await provider.createModel(makeConfig('openai'));
    expect(result).toBeUndefined();
  });

  it('createAgent returns undefined by default', async () => {
    const provider = new ConcreteProvider();
    const result = await provider.createAgent(makeConfig('openai'));
    expect(result).toBeUndefined();
  });

  it('createAgentGraph returns undefined by default', async () => {
    const provider = new ConcreteProvider();
    const result = await provider.createAgentGraph({} as any);
    expect(result).toBeUndefined();
  });

  it('createModel warns when not overridden', async () => {
    const warnSpy = jest.fn();
    const provider = new ConcreteProvider({ warn: warnSpy } as any);
    await provider.createModel(makeConfig('openai'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('createModel not implemented'));
  });

  it('createAgent warns when not overridden', async () => {
    const warnSpy = jest.fn();
    const provider = new ConcreteProvider({ warn: warnSpy } as any);
    await provider.createAgent(makeConfig('openai'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('createAgent not implemented'));
  });

  it('createAgentGraph warns when not overridden', async () => {
    const warnSpy = jest.fn();
    const provider = new ConcreteProvider({ warn: warnSpy } as any);
    await provider.createAgentGraph({} as any);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('createAgentGraph not implemented'));
  });
});
