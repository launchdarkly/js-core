import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common/dist/internal';

import { DataSourceState } from '../../src/datasource/DataSourceStatus';
import DataSourceStatusManager from '../../src/datasource/DataSourceStatusManager';

describe('DataSourceStatusManager', () => {
  test('its first state is closed', async () => {
    const underTest = new DataSourceStatusManager();
    expect(underTest.status.state).toEqual(DataSourceState.Closed);
  });

  test('it stays at initializing if receives recoverable error', async () => {
    const underTest = new DataSourceStatusManager();
    underTest.requestStateUpdate(DataSourceState.Initializing);
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, true);
    expect(underTest.status.state).toEqual(DataSourceState.Initializing);
  });

  test('it moves to closed if receives unrecoverable error', async () => {
    const underTest = new DataSourceStatusManager();
    underTest.requestStateUpdate(DataSourceState.Initializing);
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 404, false);
    expect(underTest.status.state).toEqual(DataSourceState.Closed);
  });

  test('it updates last error time with each error, but not stateSince', async () => {
    let time = 0;
    const stamper: () => number = () => time;
    const underTest = new DataSourceStatusManager(stamper);
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

    const underTest = new DataSourceStatusManager(stamper);
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
    const underTest = new DataSourceStatusManager(stamper);
    const spyListener = jest.fn();
    underTest.on(spyListener);

    underTest.requestStateUpdate(DataSourceState.SetOffline);
    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 400, true);
    time += 1;
    underTest.reportError(DataSourceErrorKind.ErrorResponse, 'womp', 400, true);
    time += 1;
    underTest.requestStateUpdate(DataSourceState.Closed);
    expect(spyListener).toHaveBeenCalledTimes(4);
    expect(spyListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        state: DataSourceState.SetOffline,
        stateSince: 0,
        lastError: undefined,
      }),
    );
    expect(spyListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        state: DataSourceState.Interrupted,
        stateSince: 1,
        lastError: expect.anything(),
      }),
    );
    expect(spyListener).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        state: DataSourceState.Interrupted,
        stateSince: 1, // still in state interrupted
        lastError: expect.anything(),
      }),
    );
    expect(spyListener).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        state: DataSourceState.Closed,
        stateSince: 3,
        lastError: expect.anything(),
      }),
    );
  });
});
