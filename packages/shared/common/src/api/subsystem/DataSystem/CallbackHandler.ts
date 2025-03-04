import { Data, DataSourceState } from './DataSource';

/**
 * Handler that connects the current {@link DataSource} to the {@link CompositeDataSource}.  A single
 * {@link CallbackHandler} should only be given to one {@link DataSource}.  Use {@link disable()} to
 * prevent additional callback events.
 */
export class CallbackHandler {
  private _disabled: boolean = false;

  constructor(
    private readonly _dataCallback: (basis: boolean, data: Data) => void,
    private readonly _statusCallback: (status: DataSourceState, err?: any) => void,
  ) {}

  disable() {
    this._disabled = true;
  }

  async dataHanlder(basis: boolean, data: Data) {
    if (this._disabled) {
      return;
    }

    // TODO: SDK-1044 track selector for future synchronizer to use
    // report data up
    this._dataCallback(basis, data);
  }

  async statusHandler(status: DataSourceState, err?: any) {
    if (this._disabled) {
      return;
    }

    this._statusCallback(status, err);
  }
}
