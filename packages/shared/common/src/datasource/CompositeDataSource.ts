/* eslint-disable no-await-in-loop */
import { LDLogger } from '../api/logging';
import { CallbackHandler } from '../api/subsystem/DataSystem/CallbackHandler';
import {
  DataSource,
  DataSourceState,
  LDDataSourceFactory,
} from '../api/subsystem/DataSystem/DataSource';
import { Backoff, DefaultBackoff } from './Backoff';
import { DataSourceList } from './dataSourceList';
import { LDFlagDeliveryFallbackError } from './errors';

const DEFAULT_FALLBACK_TIME_MS = 2 * 60 * 1000;
const DEFAULT_RECOVERY_TIME_MS = 5 * 60 * 1000;

/**
 * Represents a transition between data sources.
 */
export type Transition = 'switchToSync' | 'fallback' | 'recover' | 'stop';

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

  private _initPhaseActive: boolean;
  private _initFactories: DataSourceList<LDDataSourceFactory>;
  private _syncFactories: DataSourceList<LDDataSourceFactory>;
  private _fdv1Synchronizers: DataSourceList<LDDataSourceFactory>;

  private _stopped: boolean = true;
  private _externalTransitionPromise: Promise<TransitionRequest>;
  private _externalTransitionResolve?: (value: TransitionRequest) => void;
  private _cancelTokens: (() => void)[] = [];

  /**
   * @param initializers factories to create {@link DataSystemInitializer}s, in priority order.
   * @param synchronizers factories to create  {@link DataSystemSynchronizer}s, in priority order.
   * @param fdv1Synchronizers factories to fallback to if we need to fallback to FDv1.
   * @param _logger for logging
   * @param _transitionConditions to control automated transition between datasources. Typically only used for testing.
   * @param _backoff to control delay between transitions. Typically only used for testing.
   */
  constructor(
    initializers: LDDataSourceFactory[],
    synchronizers: LDDataSourceFactory[],
    fdv1Synchronizers: LDDataSourceFactory[],
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
    private readonly _backoff: Backoff = new DefaultBackoff(1000, 30000),
  ) {
    this._externalTransitionPromise = new Promise<TransitionRequest>((resolveTransition) => {
      this._externalTransitionResolve = resolveTransition;
    });
    this._initPhaseActive = initializers.length > 0; // init phase if we have initializers
    this._initFactories = new DataSourceList(false, initializers);
    this._syncFactories = new DataSourceList(true, synchronizers);
    this._fdv1Synchronizers = new DataSourceList(true, fdv1Synchronizers);
  }

  async start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: DataSourceState, err?: any) => void,
    selectorGetter?: () => string | undefined,
  ): Promise<void> {
    if (!this._stopped) {
      // don't allow multiple simultaneous runs
      this._logger?.info('CompositeDataSource already running. Ignoring call to start.');
      return;
    }
    this._stopped = false;

    this._logger?.debug(
      `CompositeDataSource starting with (${this._initFactories.length()} initializers, ${this._syncFactories.length()} synchronizers).`,
    );

    // this wrapper turns status updates from underlying data sources into a valid series of status updates for the consumer of this
    // composite data source
    const sanitizedStatusCallback = this._wrapStatusCallbackWithSanitizer(statusCallback);
    sanitizedStatusCallback(DataSourceState.Initializing);

    let lastTransition: Transition | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const {
        dataSource: currentDS,
        isPrimary,
        cullDSFactory,
      } = this._pickDataSource(lastTransition);

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
                sanitizedStatusCallback(DataSourceState.Interrupted);
                transitionResolve({ transition: 'switchToSync' });
              }
            },
            (state: DataSourceState, err?: any) => {
              // When we get a status update, we want to fallback if it is an error.  We also want to schedule a transition for some
              // time in the future if this status remains for some duration (ex: Recover to primary synchronizer after the secondary
              // synchronizer has been Valid for some time).  These scheduled transitions are configurable in the constructor.
              this._logger?.debug(
                `CompositeDataSource received state ${state} from underlying data source.  Err is ${err}`,
              );
              if (err || state === DataSourceState.Closed) {
                callbackHandler.disable();
                if (err?.recoverable === false) {
                  // don't use this datasource's factory again
                  this._logger?.debug(`Culling data source due to err ${err}`);
                  cullDSFactory?.();

                  // this error indicates we should fallback to only using FDv1 synchronizers
                  if (err instanceof LDFlagDeliveryFallbackError) {
                    this._logger?.debug(`Falling back to FDv1`);
                    this._syncFactories = this._fdv1Synchronizers;
                  }
                }
                sanitizedStatusCallback(state, err);
                this._consumeCancelToken(cancelScheduledTransition);
                transitionResolve({ transition: 'fallback', err }); // unrecoverable error has occurred, so fallback
              } else {
                sanitizedStatusCallback(state);
                if (state !== lastState) {
                  lastState = state;
                  this._consumeCancelToken(cancelScheduledTransition); // cancel previously scheduled status transition if one was scheduled

                  // primary source cannot recover to itself, so exclude it
                  const condition = this._lookupTransitionCondition(state, isPrimary);
                  if (condition) {
                    const { promise, cancel } = this._cancellableDelay(condition.durationMS);
                    cancelScheduledTransition = cancel;
                    this._cancelTokens.push(cancelScheduledTransition);
                    promise.then(() => {
                      this._consumeCancelToken(cancel);
                      callbackHandler.disable();
                      sanitizedStatusCallback(DataSourceState.Interrupted);
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
            selectorGetter,
          );
        } else {
          // we don't have a data source to use!
          transitionResolve({
            transition: 'stop',
            err: {
              name: 'ExhaustedDataSources',
              message: `CompositeDataSource has exhausted all configured initializers and synchronizers.`,
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
        const delayedTransition = promise.then(() => {
          this._consumeCancelToken(cancelDelay);
          return transitionRequest;
        });

        // race the delayed transition and external transition requests to be responsive
        transitionRequest = await Promise.race([
          delayedTransition,
          this._externalTransitionPromise,
        ]);

        // consume the delay cancel token (even if it resolved, need to stop tracking its token)
        this._consumeCancelToken(cancelDelay);
      }

      lastTransition = transitionRequest.transition;
      if (transitionRequest.transition === 'stop') {
        // exit the loop, this is intentionally not the sanitized status callback
        statusCallback(DataSourceState.Closed, transitionRequest.err);
        break;
      }
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
    this._initPhaseActive = this._initFactories.length() > 0; // init phase if we have initializers;
    this._initFactories.reset();
    this._syncFactories.reset();
    this._fdv1Synchronizers.reset();
    this._externalTransitionPromise = new Promise<TransitionRequest>((tr) => {
      this._externalTransitionResolve = tr;
    });
    // intentionally not resetting the backoff to avoid a code path that could circumvent throttling
  }

  /**
   * Determines the next datasource and returns that datasource as well as a closure to cull the
   * datasource from the datasource lists. One example where the cull closure is invoked is if the
   * datasource has an unrecoverable error.
   */
  private _pickDataSource(transition?: Transition): {
    dataSource: DataSource | undefined;
    isPrimary: boolean;
    cullDSFactory: (() => void) | undefined;
  } {
    let factory: LDDataSourceFactory | undefined;
    let isPrimary: boolean;
    switch (transition) {
      case 'switchToSync':
        this._initPhaseActive = false; // one way toggle to false, unless this class is reset()
        this._syncFactories.reset();
        isPrimary = this._syncFactories.pos() === 0;
        factory = this._syncFactories.next();
        break;
      case 'recover':
        if (this._initPhaseActive) {
          this._initFactories.reset();
          isPrimary = this._initFactories.pos() === 0;
          factory = this._initFactories.next();
        } else {
          this._syncFactories.reset();
          isPrimary = this._syncFactories.pos() === 0;
          factory = this._syncFactories.next();
        }
        break;
      case 'fallback':
      default:
        // if asked to fallback after using all init factories, switch to sync factories
        if (this._initPhaseActive && this._initFactories.pos() >= this._initFactories.length()) {
          this._initPhaseActive = false;
          this._syncFactories.reset();
        }

        if (this._initPhaseActive) {
          isPrimary = this._initFactories.pos() === 0;
          factory = this._initFactories.next();
        } else {
          isPrimary = this._syncFactories.pos() === 0;
          factory = this._syncFactories.next();
        }
        break;
    }

    if (!factory) {
      return { dataSource: undefined, isPrimary, cullDSFactory: undefined };
    }

    return {
      dataSource: factory(),
      isPrimary,
      cullDSFactory: () => {
        if (factory) {
          this._syncFactories.remove(factory);
        }
      },
    };
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
    if (excludeRecover && condition?.transition === 'recover') {
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

  /**
   * This wrapper will ensure the following:
   *
   * Don't report DataSourceState.Initializing except as first status callback.
   * Map underlying DataSourceState.Closed to interrupted.
   * Don't report the same status and error twice in a row.
   */
  private _wrapStatusCallbackWithSanitizer(
    statusCallback: (status: DataSourceState, err?: any) => void,
  ): (status: DataSourceState, err?: any) => void {
    let alreadyReportedInitializing = false;
    let lastStatus: DataSourceState | undefined;
    let lastErr: any;

    return (status: DataSourceState, err?: any) => {
      let sanitized = status;
      // underlying errors, closed state, or off are masked as interrupted while we transition
      if (status === DataSourceState.Closed) {
        sanitized = DataSourceState.Interrupted;
      }

      // don't report the same combination of values twice in a row
      if (sanitized === lastStatus && err === lastErr) {
        return;
      }

      if (sanitized === DataSourceState.Initializing) {
        // don't report initializing again if that has already been reported
        if (alreadyReportedInitializing) {
          return;
        }
        alreadyReportedInitializing = true;
      }

      lastStatus = sanitized;
      lastErr = err;
      statusCallback(sanitized, err);
    };
  }
}
