import { DataSourceState } from './DataSource';

/**
 * Handler that connects the current {@link DataSource} to the {@link CompositeDataSource}.  A single
 * {@link CallbackHandler} should only be given to one {@link DataSource}.  Use {@link disable()} to
 * prevent additional callback events.
 */
export class CallbackHandler {
  private _disabled: boolean = false;

  constructor(
    private readonly _dataCallback: (basis: boolean, data: any) => void,
    private readonly _statusCallback: (status: DataSourceState, err?: any) => void,
  ) {}

  disable() {
    this._disabled = true;
  }

  async dataHandler(basis: boolean, data: any) {
    if (this._disabled) {
      return;
    }

    this._dataCallback(basis, data);
  }

  async statusHandler(status: DataSourceState, err?: any) {
    if (this._disabled) {
      return;
    }

    this._statusCallback(status, err);
  }
}
