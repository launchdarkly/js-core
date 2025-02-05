import { Data, HealthStatus } from './DataSource';

export enum Transition {
  SwitchToSync,
  Fallback,
  Recover,
  Stop,
}

export type TransitionCondition = (status: HealthStatus, durationMS: number) => boolean;

export default class CallbackHandler {
  private _disabled: boolean = false;

  constructor(
    private readonly _dataCallback: (basis: boolean, data: Data) => void,
    private readonly _errorCallback: (err: any) => void,
    private readonly _triggerTransition: (value: Transition | PromiseLike<Transition>) => void,
    private readonly _isInitializer: boolean,
    private readonly _recoveryCondition: (status: HealthStatus, durationMS: number) => boolean,
    private readonly _fallbackCondition: (status: HealthStatus, durationMS: number) => boolean,
  ) {}

  dataHanlder = async (basis: boolean, data: Data) => {
    if (this._disabled) {
      return;
    }

    // report data up
    this._dataCallback(basis, data);

    // TODO: track selector for future synchronizer to use
    if (basis && this._isInitializer) {
      this._disabled = true; // getting basis means this initializer has done its job, time to move on to sync!
      this._triggerTransition(Transition.SwitchToSync);
    }
  };

  statusHandler = async (status: HealthStatus, durationMS: number) => {
    if (this._disabled) {
      return;
    }

    if (this._recoveryCondition(status, durationMS)) {
      this._disabled = true;
      this._triggerTransition(Transition.Recover);
    } else if (this._fallbackCondition(status, durationMS)) {
      this._disabled = true;
      this._triggerTransition(Transition.Fallback);
    }
  };

  errorHandler = async (err: any) => {
    // TODO: in the future, server controlled backoff (HTTP 429, 529) in this layer if it makes sense
    // TODO: unrecoverable error handling
    if (this._disabled) {
      return;
    }
    this._disabled = true;

    // report error up
    this._errorCallback(err);

    this._triggerTransition(Transition.Fallback);
  };
}
