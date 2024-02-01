import deepCompact from './deepCompact';

describe('deepCompact', () => {
  test('if arg is undefined, return it', () => {
    const compacted = deepCompact(undefined);
    expect(compacted).toBeUndefined();
  });

  test('should remove all falsy, {} and ignored values', () => {
    const data = {
      ld_application: {
        key: '',
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      },
      ld_device: {
        key: '',
        envAttributesVersion: '1.0',
        os: {},
        manufacturer: 'coconut',
        model: null,
        storageBytes: undefined,
      },
    };
    const compacted = deepCompact(data, ['key', 'envAttributesVersion']);
    expect(compacted).toEqual({
      ld_application: {
        id: 'com.testapp.ld',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      },
      ld_device: {
        manufacturer: 'coconut',
      },
    });
  });
});
