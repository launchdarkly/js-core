import {
  CustomDataSourceOptions,
  PollingDataSourceConfiguration,
  PollingDataSourceOptions,
  StandardDataSourceOptions,
  StreamingDataSourceConfiguration,
  StreamingDataSourceOptions,
} from '../../src/api/options/LDDataSystemOptions';

describe('baseUri is scoped to custom-mode data source configuration only', () => {
  it('does not allow baseUri on StandardDataSourceOptions', () => {
    const opts: StandardDataSourceOptions = {
      dataSourceOptionsType: 'standard',
      // @ts-expect-error standard mode already gets its endpoints from
      // Configuration.serviceEndpoints; there is no per-source override
      baseUri: 'https://example.com',
    };
    expect(opts).toBeTruthy();
  });

  it('does not allow baseUri on StreamingDataSourceOptions', () => {
    const opts: StreamingDataSourceOptions = {
      dataSourceOptionsType: 'streamingOnly',
      // @ts-expect-error streamingOnly already gets its endpoint from
      // Configuration.serviceEndpoints.streaming; there is no per-source override
      baseUri: 'https://example.com',
    };
    expect(opts).toBeTruthy();
  });

  it('does not allow baseUri on PollingDataSourceOptions', () => {
    const opts: PollingDataSourceOptions = {
      dataSourceOptionsType: 'pollingOnly',
      // @ts-expect-error pollingOnly already gets its endpoint from
      // Configuration.serviceEndpoints.polling; there is no per-source override
      baseUri: 'https://example.com',
    };
    expect(opts).toBeTruthy();
  });

  it('still allows baseUri on the custom mode streaming synchronizer configuration', () => {
    const config: StreamingDataSourceConfiguration = {
      type: 'streaming',
      baseUri: 'https://custom-stream.example.com',
    };
    expect(config.baseUri).toBe('https://custom-stream.example.com');
  });

  it('still allows baseUri on the custom mode polling initializer/synchronizer configuration', () => {
    const config: PollingDataSourceConfiguration = {
      type: 'polling',
      baseUri: 'https://custom-poll.example.com',
    };
    expect(config.baseUri).toBe('https://custom-poll.example.com');
  });

  it('still allows per-source baseUri inside a CustomDataSourceOptions data source', () => {
    const custom: CustomDataSourceOptions = {
      dataSourceOptionsType: 'custom',
      initializers: [{ type: 'polling', baseUri: 'https://custom-init.example.com' }],
      synchronizers: [{ type: 'streaming', baseUri: 'https://custom-sync.example.com' }],
    };
    expect(custom.initializers[0]).toMatchObject({ baseUri: 'https://custom-init.example.com' });
    expect(custom.synchronizers[0]).toMatchObject({ baseUri: 'https://custom-sync.example.com' });
  });
});
