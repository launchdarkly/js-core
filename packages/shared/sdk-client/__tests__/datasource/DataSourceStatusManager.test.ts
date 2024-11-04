import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import { DataSourceState } from '../../src/datasource/DataSourceStatus';
import DataSourceStatusManager from '../../src/datasource/DataSourceStatusManager';
import LDEmitter from '../../src/LDEmitter';

describe('DataSourceStatusManager', () => {
  test('its first state is closed', async () => {
    const underTest = new DataSourceStatusManager(new LDEmitter());
    expect(underTest.status.state).toEqual(DataSourceState.Closed);
  });

  test('it stays at initializing if receives recoverable error', async () => {
    const underTest = new DataSourceStatusManager(new LDEmitter());
    underTest.requestStateUpdate(DataSourceState.Initializing);
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, true);
    expect(underTest.status.state).toEqual(DataSourceState.Initializing);
  });

  test('it moves to closed if receives unrecoverable error', async () => {
    const underTest = new DataSourceStatusManager(new LDEmitter());
    underTest.requestStateUpdate(DataSourceState.Initializing);
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, false);
    expect(underTest.status.state).toEqual(DataSourceState.Closed);
  });

  test('it updates last error time with each error, but not stateSince', async () => {
    let time = 0;
    const stamper: () => number = () => time;
    const underTest = new DataSourceStatusManager(new LDEmitter(), stamper);
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, true);
    expect(underTest.status.stateSince).toEqual(0);
    expect(underTest.status.lastError?.time).toEqual(0);

    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, true);
    expect(underTest.status.stateSince).toEqual(0);
    expect(underTest.status.lastError?.time).toEqual(1);

    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, true);
    expect(underTest.status.stateSince).toEqual(0);
    expect(underTest.status.lastError?.time).toEqual(2);
  });

  test('it updates stateSince when transitioning', async () => {
    let time = 0;
    const stamper: () => number = () => time;

    const underTest = new DataSourceStatusManager(new LDEmitter(), stamper);
    expect(underTest.status.state).toEqual(DataSourceState.Closed);
    expect(underTest.status.stateSince).toEqual(0);

    time += 1;
    underTest.requestStateUpdate(DataSourceState.Valid);
    expect(underTest.status.stateSince).toEqual(1);

    time += 1;
    underTest.requestStateUpdate(DataSourceState.Closed);
    expect(underTest.status.stateSince).toEqual(2);
  });

  test('it notifies listeners when state changes', async () => {
    let time = 0;
    const stamper: () => number = () => time;
    const emitter = new LDEmitter();
    const spy = jest.spyOn(emitter, 'emit');
    const underTest = new DataSourceStatusManager(emitter, stamper);

    underTest.requestStateUpdate(DataSourceState.SetOffline);
    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 400, true);
    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 400, true);
    time += 1;
    underTest.requestStateUpdate(DataSourceState.Closed);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenNthCalledWith(
      1,
      'dataSourceStatus',
      expect.objectContaining({
        state: DataSourceState.SetOffline,
        stateSince: 0,
        lastError: undefined,
      }),
    );
    expect(spy).toHaveBeenNthCalledWith(
      2,
      'dataSourceStatus',
      expect.objectContaining({
        state: DataSourceState.Interrupted,
        stateSince: 1,
        lastError: expect.anything(),
      }),
    );
    expect(spy).toHaveBeenNthCalledWith(
      3,
      'dataSourceStatus',
      expect.objectContaining({
        state: DataSourceState.Interrupted,
        stateSince: 1, // still in state interrupted
        lastError: expect.anything(),
      }),
    );
    expect(spy).toHaveBeenNthCalledWith(
      4,
      'dataSourceStatus',
      expect.objectContaining({
        state: DataSourceState.Closed,
        stateSince: 3,
        lastError: expect.anything(),
      }),
    );
  });
});
