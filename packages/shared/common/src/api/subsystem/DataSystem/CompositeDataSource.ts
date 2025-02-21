/* eslint-disable no-await-in-loop */
import Backoff from '../../../datasource/Backoff';
import { CallbackHandler } from './CallbackHandler';
import {
  Data,
  DataSource,
  DataSourceState,
  InitializerFactory,
  SynchronizerFactory,
} from './DataSource';

/**
 * Represents a transition between data sources.
 */
export enum Transition {
  /**
   * A no-op transition.
   */
  None,
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
}

/**
 * Given a {@link DataSourceState}, how long to wait before transitioning.
 */
export type TransitionConditions = {
  [k in DataSourceState]?: { durationMS: number; transition: Transition };
};

interface TransitionRequest {
  transition: Transition;
  err?: Error;
}

/**
 * The {@link CompositeDataSource} can combine a number of {@link DataSystemInitializer}s and {@link DataSystemSynchronizer}s
 * into a single {@link DataSource}, implementing fallback and recovery logic internally to choose where data is sourced from.
 */
export class CompositeDataSource implements DataSource {
  // TODO: SDK-856 async notification if initializer takes too long
  // TODO: SDK-1044 utilize selector from initializers
  private readonly _defaultFallbackTimeMs = 2 * 60 * 1000;
  private readonly _defaultRecoveryTimeMs = 5 * 60 * 1000;

  private _initPhaseActive: boolean = true;
  private _currentPosition: number = 0;
  private _backoff: Backoff;

  private _stopped: boolean = true;
  private _externalStopPromise: Promise<TransitionRequest>;
  private _externalStopResolve?: (value: TransitionRequest) => void;

  /**
   * @param _initializers factories to create {@link DataSystemInitializer}s, in priority order.
   * @param _synchronizers factories to create  {@link DataSystemSynchronizer}s, in priority order.
   */
  constructor(
    private readonly _initializers: InitializerFactory[],
    private readonly _synchronizers: SynchronizerFactory[],
    private readonly _transitionConditions: TransitionConditions,
    initialRetryDelayMillis: number,
    retryResetIntervalMillis: number,
  ) {
    this._externalStopPromise = new Promise<TransitionRequest>((tr) => {
      this._externalStopResolve = tr;
    });
    this._initPhaseActive = true;
    this._currentPosition = 0;
    this._backoff = new Backoff(initialRetryDelayMillis, retryResetIntervalMillis);
  }

  async run(
    dataCallback: (basis: boolean, data: Data) => void,
    statusCallback: (status: DataSourceState, err?: any) => void,
  ): Promise<void> {
    if (!this._stopped) {
      // don't allow multiple simultaneous runs
      return;
    }
    this._stopped = false;

    let lastTransition: Transition = Transition.None;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this._stopped) {
        // report we are closed, no error as this was due to stop breaking the loop
        statusCallback(DataSourceState.Closed, null);
        break;
      }

      const current: DataSource | undefined = this._pickDataSource(lastTransition);
      if (current === undefined) {
        statusCallback(DataSourceState.Closed, {
          name: 'ExhaustedDataSources',
          message: `CompositeDataSource has exhausted all configured datasources (${this._initializers.length} initializers, ${this._synchronizers.length} synchronizers).`,
        });
        break;
      }

      const internalTransitionPromise = new Promise<TransitionRequest>((transitionResolve) => {
        // these local variables are used for handling automatic transition related to data source status (ex: recovering to primary after
        // secondary has been valid for N many minutes)
        let lastState: DataSourceState | undefined;
        let cancelScheduledTransition: (() => void) | undefined;

        const callbackHandler = new CallbackHandler(
          (basis: boolean, data: Data) => {
            dataCallback(basis, data);
            if (basis && this._initPhaseActive) {
              // transition to sync if we get basis during init
              callbackHandler.disable();
              cancelScheduledTransition?.();
              transitionResolve({ transition: Transition.SwitchToSync });
            }
          },
          (state: DataSourceState, err?: any) => {
            // When we get a status update, we want to fallback if it is an error.  We also want to schedule a transition for some
            // time in the future if this status remains for some duration (ex: Recover to primary synchronizer after the secondary
            // synchronizer has been Valid for some time).  These scheduled transitions are configurable in the constructor.

            if (err || state === DataSourceState.Closed) {
              callbackHandler.disable();
              statusCallback(DataSourceState.Interrupted, null); // underlying errors or closed states are masked as interrupted while we transition
              cancelScheduledTransition?.();
              transitionResolve({ transition: Transition.Fallback, err }); // unrecoverable error has occurred, so fallback
            } else {
              if (state !== lastState) {
                lastState = state;
                cancelScheduledTransition?.(); // cancel previously scheduled status transition if one was scheduled
                const excludeRecovery = this._currentPosition === 0; // primary source cannot recover to itself, so exclude it
                const condition = this._lookupTransitionCondition(state, excludeRecovery);
                if (condition) {
                  const { promise, cancel } = this._cancellableDelay(condition.durationMS);
                  cancelScheduledTransition = cancel;
                  promise.then(() => {
                    callbackHandler.disable();
                    transitionResolve({ transition: condition.transition });
                  });
                } else {
                  // this data source state does not have a transition condition, so don't schedule any transition
                }
              }
              statusCallback(state, null); // report the status upward
            }
          },
        );
        current.run(callbackHandler.dataHanlder, callbackHandler.statusHandler);
      });

      // await transition triggered by internal data source or an external stop request
      const transitionRequest = await Promise.race([
        internalTransitionPromise,
        this._externalStopPromise,
      ]);

      // if the transition was due to an error, throttle the transition
      if (transitionRequest.err) {
        const delay = this._backoff.fail();
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }

      // stop the underlying datasource before transitioning to next state
      current.stop();
      lastTransition = transitionRequest.transition;
    }

    // reset so that run can be called again in the future
    this._reset();
  }

  async stop() {
    this._stopped = true;
    this._externalStopResolve?.({ transition: Transition.None }); // the value here doesn't matter, just needs to break the loop's await
  }

  private _reset() {
    this._initPhaseActive = true;
    this._currentPosition = 0;
    this._externalStopPromise = new Promise<TransitionRequest>((tr) => {
      this._externalStopResolve = tr;
    });
    // intentionally not resetting the backoff to avoid a code path that could circumvent throttling
  }

  private _pickDataSource(transition: Transition | undefined): DataSource | undefined {
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
      // We don't loop back through initializers, so if outside range of initializers, instead return undefined.
      if (this._currentPosition > this._initializers.length - 1) {
        return undefined;
      }

      return this._initializers[this._currentPosition].create();
    }
    // getting here indicates we are using a synchronizer

    // if no synchronizers, return undefined
    if (this._synchronizers.length <= 0) {
      return undefined;
    }
    this._currentPosition %= this._synchronizers.length; // modulate position to loop back to start if necessary
    if (this._currentPosition > this._synchronizers.length - 1) {
      // this is only possible if no synchronizers were provided
      return undefined;
    }
    return this._synchronizers[this._currentPosition].create();
  }

  /**
   * @returns the transition condition for the provided data source state or undefined
   * if there is no transition condition
   */
  private _lookupTransitionCondition(
    state: DataSourceState,
    excludeRecover: boolean,
  ): { durationMS: number; transition: Transition } | undefined {
    const condition = this._transitionConditions[state];

    // exclude recovery can happen for certain initializers/synchronizers (ex: the primary synchronizer shouldn't recover to itself)
    if (!condition || (excludeRecover && condition.transition === Transition.Recover)) {
      return undefined;
    }

    return condition;
  }

  private _cancellableDelay = (delayMS: number) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let reject: ((reason?: any) => void) | undefined;
    const promise = new Promise((res, rej) => {
      timeout = setTimeout(res, delayMS);
      reject = rej;
    });
    return {
      promise,
      cancel() {
        if (timeout) {
          clearTimeout(timeout);
          reject?.();
          timeout = undefined;
          reject = undefined;
        }
      },
    };
  };
}
