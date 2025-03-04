/* eslint-disable no-await-in-loop */
import { LDLogger } from '../api/logging';
import { CallbackHandler } from '../api/subsystem/DataSystem/CallbackHandler';
import {
  DataSource,
  DataSourceState,
  LDInitializerFactory,
  LDSynchronizerFactory,
} from '../api/subsystem/DataSystem/DataSource';
import { Backoff, DefaultBackoff } from './Backoff';

const DEFAULT_FALLBACK_TIME_MS = 2 * 60 * 1000;
const DEFAULT_RECOVERY_TIME_MS = 5 * 60 * 1000;

/**
 * Represents a transition between data sources.
 */
export type Transition = 'none' | 'switchToSync' | 'fallback' | 'recover' | 'stop';

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

// TODO SDK-858: move this out of API directory to neighbor datasource folder
/**
 * The {@link CompositeDataSource} can combine a number of {@link DataSystemInitializer}s and {@link DataSystemSynchronizer}s
 * into a single {@link DataSource}, implementing fallback and recovery logic internally to choose where data is sourced from.
 */
export class CompositeDataSource implements DataSource {
  // TODO: SDK-856 async notification if initializer takes too long
  // TODO: SDK-1044 utilize selector from initializers

  private _initPhaseActive: boolean;
  private _currentPosition: number;

  private _stopped: boolean = true;
  private _externalTransitionPromise: Promise<TransitionRequest>;
  private _externalTransitionResolve?: (value: TransitionRequest) => void;
  private _cancelTokens: (() => void)[] = [];

  /**
   * @param _initializers factories to create {@link DataSystemInitializer}s, in priority order.
   * @param _synchronizers factories to create  {@link DataSystemSynchronizer}s, in priority order.
   */
  constructor(
    private readonly _initializers: LDInitializerFactory[],
    private readonly _synchronizers: LDSynchronizerFactory[],
    private readonly _logger?: LDLogger,
    private readonly _transitionConditions: TransitionConditions = {
      [DataSourceState.Valid]: {
        durationMS: DEFAULT_RECOVERY_TIME_MS,
        transition: 'recover',
      },
      [DataSourceState.Interrupted]: {
        durationMS: DEFAULT_FALLBACK_TIME_MS,
        transition: 'fallback',
      },
    },
    private readonly _backoff: Backoff = new DefaultBackoff(
      1000, // TODO SDK-1137: handle blacklisting perpetually failing sources
      30000,
    ),
  ) {
    this._externalTransitionPromise = new Promise<TransitionRequest>((resolveTransition) => {
      this._externalTransitionResolve = resolveTransition;
    });
    this._initPhaseActive = _initializers.length > 0; // init phase if we have initializers
    this._currentPosition = 0;
  }

  async start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: DataSourceState, err?: any) => void,
  ): Promise<void> {
    if (!this._stopped) {
      // don't allow multiple simultaneous runs
      this._logger?.info('CompositeDataSource already running. Ignoring call to start.');
      return;
    }
    this._stopped = false;

    this._logger?.debug(
      `CompositeDataSource starting with (${this._initializers.length} initializers, ${this._synchronizers.length} synchronizers).`,
    );
    let lastTransition: Transition = 'none';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentDS: DataSource | undefined = this._pickDataSource(lastTransition);
      const internalTransitionPromise = new Promise<TransitionRequest>((transitionResolve) => {
        if (currentDS) {
          // these local variables are used for handling automatic transition related to data source status (ex: recovering to primary after
          // secondary has been valid for N many seconds)
          let lastState: DataSourceState | undefined;
          let cancelScheduledTransition: () => void = () => {};

          // this callback handler can be disabled and ensures only one transition request occurs
          const callbackHandler = new CallbackHandler(
            (basis: boolean, data: any) => {
              this._backoff.success();
              dataCallback(basis, data);
              if (basis && this._initPhaseActive) {
                // transition to sync if we get basis during init
                callbackHandler.disable();
                this._consumeCancelToken(cancelScheduledTransition);
                transitionResolve({ transition: 'switchToSync' });
              }
            },
            (state: DataSourceState, err?: any) => {
              // When we get a status update, we want to fallback if it is an error.  We also want to schedule a transition for some
              // time in the future if this status remains for some duration (ex: Recover to primary synchronizer after the secondary
              // synchronizer has been Valid for some time).  These scheduled transitions are configurable in the constructor.
              this._logger?.debug(
                `CompositeDataSource received state ${state} from underlying data source.`,
              );
              if (err || state === DataSourceState.Closed) {
                callbackHandler.disable();
                statusCallback(DataSourceState.Interrupted, err); // underlying errors or closed states are masked as interrupted while we transition
                this._consumeCancelToken(cancelScheduledTransition);
                transitionResolve({ transition: 'fallback', err }); // unrecoverable error has occurred, so fallback
              } else {
                statusCallback(state, null); // report the status upward
                if (state !== lastState) {
                  lastState = state;
                  this._consumeCancelToken(cancelScheduledTransition); // cancel previously scheduled status transition if one was scheduled
                  const excludeRecovery = this._currentPosition === 0; // primary source cannot recover to itself, so exclude it
                  const condition = this._lookupTransitionCondition(state, excludeRecovery);
                  if (condition) {
                    const { promise, cancel } = this._cancellableDelay(condition.durationMS);
                    cancelScheduledTransition = cancel;
                    this._cancelTokens.push(cancelScheduledTransition);
                    promise.then(() => {
                      callbackHandler.disable();
                      transitionResolve({ transition: condition.transition });
                    });
                  } else {
                    // this data source state does not have a transition condition, so don't schedule any transition
                  }
                }
              }
            },
          );
          currentDS.start(
            (basis, data) => callbackHandler.dataHandler(basis, data),
            (status, err) => callbackHandler.statusHandler(status, err),
          );
        } else {
          // we don't have a data source to use!
          transitionResolve({
            transition: 'stop',
            err: {
              name: 'ExhaustedDataSources',
              message: `CompositeDataSource has exhausted all configured datasources (${this._initializers.length} initializers, ${this._synchronizers.length} synchronizers).`,
            },
          });
        }
      });

      // await transition triggered by internal data source or an external stop request
      let transitionRequest = await Promise.race([
        internalTransitionPromise,
        this._externalTransitionPromise,
      ]);

      // stop the underlying datasource before transitioning to next state
      currentDS?.stop();

      if (transitionRequest.err && transitionRequest.transition !== 'stop') {
        // if the transition was due to an error, throttle the transition
        const delay = this._backoff.fail();
        const { promise, cancel: cancelDelay } = this._cancellableDelay(delay);
        this._cancelTokens.push(cancelDelay);
        const delayedTransition = promise.then(() => transitionRequest);

        // race the delayed transition and external transition requests to be responsive
        transitionRequest = await Promise.race([
          delayedTransition,
          this._externalTransitionPromise,
        ]);

        // consume the delay cancel token (even if it resolved, need to stop tracking its token)
        this._consumeCancelToken(cancelDelay);
      }

      if (transitionRequest.transition === 'stop') {
        // exit the loop
        statusCallback(DataSourceState.Closed, transitionRequest.err);
        lastTransition = transitionRequest.transition;
        break;
      }

      lastTransition = transitionRequest.transition;
    }

    // reset so that run can be called again in the future
    this._reset();
  }

  async stop() {
    this._cancelTokens.forEach((cancel) => cancel());
    this._cancelTokens = [];
    this._externalTransitionResolve?.({ transition: 'stop' });
  }

  private _reset() {
    this._stopped = true;
    this._initPhaseActive = this._initializers.length > 0; // init phase if we have initializers;
    this._currentPosition = 0;
    this._externalTransitionPromise = new Promise<TransitionRequest>((tr) => {
      this._externalTransitionResolve = tr;
    });
    // intentionally not resetting the backoff to avoid a code path that could circumvent throttling
  }

  private _pickDataSource(transition: Transition | undefined): DataSource | undefined {
    switch (transition) {
      case 'switchToSync':
        this._initPhaseActive = false; // one way toggle to false, unless this class is reset()
        this._currentPosition = 0;
        break;
      case 'fallback':
        this._currentPosition += 1;
        break;
      case 'recover':
        this._currentPosition = 0;
        break;
      case 'none':
      default:
        // don't do anything in this case
        break;
    }

    if (this._initPhaseActive) {
      // We don't loop back through initializers, so if outside range of initializers, instead return undefined.
      if (this._currentPosition > this._initializers.length - 1) {
        return undefined;
      }

      return this._initializers[this._currentPosition]();
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
    return this._synchronizers[this._currentPosition]();
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
    if (!condition || (excludeRecover && condition.transition === 'recover')) {
      return undefined;
    }

    return condition;
  }

  private _cancellableDelay = (delayMS: number) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise((res, _) => {
      timeout = setTimeout(res, delayMS);
    });
    return {
      promise,
      cancel() {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      },
    };
  };

  private _consumeCancelToken(cancel: () => void) {
    cancel();
    const index = this._cancelTokens.indexOf(cancel, 0);
    if (index > -1) {
      this._cancelTokens.splice(index, 1);
    }
  }
}
