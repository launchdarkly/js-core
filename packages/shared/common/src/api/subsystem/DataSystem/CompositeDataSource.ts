import { CallbackHandler, Transition, TransitionCondition } from './CallbackHandler';
import { Data, DataSource, HealthStatus } from './DataSource';
import { DataSystemInitializer, InitializerFactory } from './DataSystemInitializer';
import { DataSystemSynchronizer, SynchronizerFactory } from './DataSystemSynchronizer';

/**
 * The {@link CompositeDataSource} can combine a number of {@link DataSystemInitializer}s and {@link DataSystemSynchronizer}s
 * into a single {@link DataSource}, implementing fallback and recovery logic internally to choose where data is sourced from.
 */
export class CompositeDataSource implements DataSource {
  // TODO: SDK-856 async notification if initializer takes too long
  // TODO: SDK-1044 utilize selector from initializers

  // TODO: add datasource status APIs

  private readonly _defaultFallbackTimeMs = 2 * 60 * 1000;
  private readonly _defaultRecoveryTimeMs = 5 * 60 * 1000;

  private _initPhaseActive: boolean = true;
  private _currentPosition: number = 0;

  private _stopped: boolean = true;
  private _externalStopPromise: Promise<Transition>;
  private _externalStopResolve?: (value: Transition) => void;

  /**
   * @param _initializers factories to create {@link DataSystemInitializer}s, in priority order.
   * @param _synchronizers factories to create  {@link DataSystemSynchronizer}s, in priority order.
   */
  constructor(
    private readonly _initializers: InitializerFactory[],
    private readonly _synchronizers: SynchronizerFactory[],
  ) {
    this._externalStopPromise = new Promise<Transition>((transition) => {
      this._externalStopResolve = transition;
    });
    this._initPhaseActive = true;
    this._currentPosition = 0;
  }

  async run(
    dataCallback: (basis: boolean, data: Data) => void,
    errorCallback: (err: Error) => void,
  ): Promise<void> {
    if (!this._stopped) {
      // don't allow multiple simultaneous runs
      return;
    }
    this._stopped = false;

    let transition: Transition = Transition.None; // first loop has no transition
    while (!this._stopped) {
      const current: DataSystemInitializer | DataSystemSynchronizer | undefined =
        this._pickDataSource(transition);
      if (current === undefined) {
        errorCallback({
          name: 'ExhaustedDataSources',
          message: 'CompositeDataSource has exhausted all configured datasources.',
        });
        return;
      }

      const internalTransitionPromise = new Promise<Transition>((transitionResolve) => {
        const recoveryCondition = this._makeRecoveryCondition();
        const fallbackCondition = this._makeFallbackCondition();
        const callbackHandler = new CallbackHandler(
          dataCallback,
          errorCallback,
          transitionResolve,
          this._initPhaseActive,
          recoveryCondition,
          fallbackCondition,
        );
        current.run(
          callbackHandler.dataHanlder,
          callbackHandler.statusHandler,
          callbackHandler.errorHandler,
        );
      });

      // await transition triggered by internal data source or an external stop request
      // eslint-disable-next-line no-await-in-loop
      transition = await Promise.race([internalTransitionPromise, this._externalStopPromise]);

      // stop the current datasource before transitioning to next state
      current.stop();
    }

    // reset so that run can be called again in the future
    this._reset();
  }

  async stop() {
    this._stopped = true;
    this._externalStopResolve?.(Transition.None); // TODO: this feels a little hacky.
  }

  private _reset() {
    this._initPhaseActive = true;
    this._currentPosition = 0;
    this._externalStopPromise = new Promise<Transition>((transition) => {
      this._externalStopResolve = transition;
    });
  }

  private _pickDataSource(
    transition: Transition | undefined,
  ): DataSystemInitializer | DataSystemSynchronizer | undefined {
    switch (transition) {
      case Transition.SwitchToSync:
        this._initPhaseActive = false; // one way toggle to false, unless this class is reset()
        this._currentPosition = 0;
        break;
      case Transition.Fallback:
        this._currentPosition += 1;
        break;
      case Transition.Recover:
        this._currentPosition = 0;
        break;
      case Transition.None:
      default:
        // don't do anything in this case
        break;
    }

    if (this._initPhaseActive) {
      // if outside range of initializers, don't loop back to start, instead return undefined
      if (this._currentPosition > this._initializers.length - 1) {
        return undefined;
      }

      return this._initializers[this._currentPosition].create();
    }

    // getting here indicates we are using a synchronizer
    this._currentPosition %= this._synchronizers.length; // modulate position to loop back to start
    if (this._currentPosition > this._synchronizers.length - 1) {
      // this is only possible if no synchronizers were provided
      return undefined;
    }
    return this._synchronizers[this._currentPosition].create();
  }

  private _makeFallbackCondition(): TransitionCondition {
    return (status: HealthStatus, durationMS: number) =>
      status === HealthStatus.Interrupted && durationMS >= this._defaultFallbackTimeMs;
  }

  private _makeRecoveryCondition(): TransitionCondition {
    return (status: HealthStatus, durationMS: number) =>
      status === HealthStatus.Online && durationMS >= this._defaultRecoveryTimeMs;
  }
}
