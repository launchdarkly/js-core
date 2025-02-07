import { Data, HealthStatus } from './DataSource';

/**
 * Represents a transition between data sources.
 */
export enum Transition {
  /**
   * Transition from current data source to the first synchronizer.
   */
  SwitchToSync,

  /**
   * Transition to the next data source of the same kind.
   */
  Fallback,

  /**
   * Transition to the first data source of the same kind.
   */
  Recover,

  /**
   * A no-op transition.
   */
  None,
}

/**
 * Evaluated to determine if a transition should occur.
 */
export type TransitionCondition = (status: HealthStatus, durationMS: number) => boolean;

/**
 * Handler that connects the current {@link DataSource} to the {@link CompositeDataSource}.  A single
 * {@link CallbackHandler} should only be given to one {@link DataSource}.  Once an instance of
 * a {@link CallbackHandler} triggers a transition, it will disable itself so that future invocatons
 * on it are no-op.
 */
export class CallbackHandler {
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

    // TODO: SDK-1044 track selector for future synchronizer to use
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
    // TODO: unrecoverable error handling
    if (this._disabled) {
      return;
    }
    this._disabled = true;

    // TODO: should this error be reported or contained silently if we have a fallback?
    // report error up, discuss with others on team.
    this._errorCallback(err);

    this._triggerTransition(Transition.Fallback);
  };
}
