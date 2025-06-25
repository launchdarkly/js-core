import { LDMessage, VercelAISDKMapOptions } from '../src/api/config';
import { LDAIConfigMapperImpl } from '../src/LDAIConfigMapperImpl';

describe('_findParameter', () => {
  it('handles undefined model and messages', () => {
    const mapper = new LDAIConfigMapperImpl();
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param')).toBeUndefined();
  });

  it('handles parameter not found', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      parameters: {
        'test-param': 123,
      },
      custom: {
        'test-param': 456,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('other-param')).toBeUndefined();
  });

  it('finds parameter from single model parameter', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      parameters: {
        'test-param': 123,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param')).toEqual(123);
  });

  it('finds parameter from multiple model parameters', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      parameters: {
        testParam: 123,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param', 'testParam')).toEqual(123);
  });

  it('finds parameter from single model custom parameter', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      custom: {
        'test-param': 123,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param')).toEqual(123);
  });

  it('finds parameter from multiple model custom parameters', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      custom: {
        testParam: 123,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param', 'testParam')).toEqual(123);
  });

  it('gives precedence to model parameters over model custom parameters', () => {
    const mapper = new LDAIConfigMapperImpl({
      name: 'test-ai-model',
      parameters: {
        'test-param': 123,
      },
      custom: {
        'test-param': 456,
      },
    });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(mapper['_findParameter']<number>('test-param', 'testParam')).toEqual(123);
  });
});

describe('toVercelAIAISDK', () => {
  const mockModel = { name: 'mockModel' };
  const mockMessages: LDMessage[] = [
    { role: 'user', content: 'test prompt' },
    { role: 'system', content: 'test instruction' },
  ];
  const mockOptions: VercelAISDKMapOptions = {
    nonInterpolatedMessages: [{ role: 'assistant', content: 'test assistant instruction' }],
  };
  const mockProvider = jest.fn().mockReturnValue(mockModel);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles undefined model and messages', () => {
    const mapper = new LDAIConfigMapperImpl();
    const result = mapper.toVercelAISDK(mockProvider);

    expect(mockProvider).toHaveBeenCalledWith('');
    expect(result).toEqual(
      expect.objectContaining({
        model: mockModel,
        messages: undefined,
      }),
    );
  });

  it('uses additional messages', () => {
    const mapper = new LDAIConfigMapperImpl({ name: 'test-ai-model' });
    const result = mapper.toVercelAISDK(mockProvider, mockOptions);

    expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
    expect(result).toEqual(
      expect.objectContaining({
        model: mockModel,
        messages: mockOptions.nonInterpolatedMessages,
      }),
    );
  });

  it('combines config messages and additional messages', () => {
    const mapper = new LDAIConfigMapperImpl({ name: 'test-ai-model' }, undefined, mockMessages);
    const result = mapper.toVercelAISDK(mockProvider, mockOptions);

    expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
    expect(result).toEqual(
      expect.objectContaining({
        model: mockModel,
        messages: [...mockMessages, ...(mockOptions.nonInterpolatedMessages ?? [])],
      }),
    );
  });

  it('requests parameters correctly', () => {
    const mapper = new LDAIConfigMapperImpl({ name: 'test-ai-model' }, undefined, mockMessages);
    const findParameterMock = jest.spyOn(mapper as any, '_findParameter');
    const result = mapper.toVercelAISDK(mockProvider);

    expect(mockProvider).toHaveBeenCalledWith('test-ai-model');
    expect(result).toEqual(
      expect.objectContaining({
        model: mockModel,
        messages: mockMessages,
      }),
    );
    expect(findParameterMock).toHaveBeenCalledWith('max_tokens', 'maxTokens');
    expect(findParameterMock).toHaveBeenCalledWith('temperature');
    expect(findParameterMock).toHaveBeenCalledWith('top_p', 'topP');
    expect(findParameterMock).toHaveBeenCalledWith('top_k', 'topK');
    expect(findParameterMock).toHaveBeenCalledWith('presence_penalty', 'presencePenalty');
    expect(findParameterMock).toHaveBeenCalledWith('frequency_penalty', 'frequencyPenalty');
    expect(findParameterMock).toHaveBeenCalledWith('stop', 'stop_sequences', 'stopSequences');
    expect(findParameterMock).toHaveBeenCalledWith('seed');
  });
});
