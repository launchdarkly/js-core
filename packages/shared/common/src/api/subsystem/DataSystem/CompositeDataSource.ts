import CallbackHandler, { Transition, TransitionCondition } from './CallbackHandler';
import { Data, DataSource, HealthStatus } from './DataSource';
import { DataSystemInitializer } from './DataSystemInitializer';
import { DataSystemSynchronizer } from './DataSystemSynchronizer';

export default class CompositeDataSource implements DataSource {
  private readonly _defaultFallbackTimeMs = 2 * 60 * 1000;
  private readonly _defaultRecoveryTimeMs = 5 * 60 * 1000;

  private _initPhaseActive: boolean = true;
  private _currentPosition: number = 0;

  private _stopped: boolean = true;
  private _externalStopPromise: Promise<Transition>;
  private _externalStopResolve?: (value: Transition) => void;

  constructor(
    private readonly _initializers: DataSystemInitializer[],
    private readonly _synchronizers: DataSystemSynchronizer[],
  ) {
    this._externalStopPromise = new Promise<Transition>((transition) => {
      this._externalStopResolve = transition;
    });
    this._initPhaseActive = true;
    this._currentPosition = 0;
  }

  async run(
    dataCallback: (basis: boolean, data: Data) => void,
    errorCallback: (err: any) => void,
  ): Promise<void> {
    if (!this._stopped) {
      return;
    }
    this._stopped = false;

    // TODO: async notification if initializer takes too long
    // TODO: utilize selector from initializers

    let transition: Transition | undefined;
    while (transition !== Transition.Stop) {
      const currentDS: DataSystemInitializer | DataSystemSynchronizer | undefined =
        this._nextDataSource(transition);
      if (currentDS === undefined) {
        // TODO: handle no further data sources to use (such as when used all initializers)
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
        currentDS.run(
          callbackHandler.dataHanlder,
          callbackHandler.statusHandler,
          callbackHandler.errorHandler,
        );
      });

      // await transition triggered by internal data source or an external stop request
      // eslint-disable-next-line no-await-in-loop
      transition = await Promise.race([internalTransitionPromise, this._externalStopPromise]);

      // TODO: call stop on datasource
      //   if (currentDS instanceof DataSystemSynchronizer) {
      //     currentDS.stop?.();
      //   }
    }

    // reset so that run can be called again in the future
    this._reset();
  }

  async stop() {
    this._stopped = true;
    this._externalStopResolve?.(Transition.Stop);
  }

  private _reset() {
    this._externalStopPromise = new Promise<Transition>((transition) => {
      this._externalStopResolve = transition;
    });
    this._initPhaseActive = true;
    this._currentPosition = 0;
  }

  private _nextDataSource(
    transition: Transition | undefined,
  ): DataSystemInitializer | DataSystemSynchronizer | undefined {
    switch (transition) {
      case Transition.SwitchToSync:
        this._initPhaseActive = false;
        this._currentPosition = 0;
        break;
      case Transition.Fallback:
        this._currentPosition += 1;

        // TODO: handle reaching end of initializers with error
        if (this._initPhaseActive && this._currentPosition >= this._initializers.length) {
          return undefined;
        }

        // modulate back into range
        this._currentPosition %= this._initPhaseActive
          ? this._initializers.length
          : this._synchronizers.length;
        break;
      case Transition.Recover:
        this._currentPosition = 0;
        break;
      case Transition.Stop:
      default:
        return undefined;
        break;
    }

    if (this._initPhaseActive) {
      return this._initializers[this._currentPosition];
    }
    return this._synchronizers[this._currentPosition];
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
