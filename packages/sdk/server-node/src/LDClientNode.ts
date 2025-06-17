// eslint-disable-next-line max-classes-per-file
import { EventEmitter } from 'events';
import { format } from 'util';

import {
  BasicLogger,
  internal,
  LDClientImpl,
  LDPluginEnvironmentMetadata,
  SafeLogger,
  TypeValidators,
} from '@launchdarkly/js-server-sdk-common';

import { BigSegmentStoreStatusProvider, LDClient } from './api';
import { LDOptions } from './api/LDOptions';
import { LDPlugin } from './api/LDPlugin';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import NodePlatform from './platform/NodePlatform';

/**
 * @ignore
 */
class LDClientNode extends LDClientImpl implements LDClient {
  bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;
  emitter: EventEmitter;

  constructor(sdkKey: string, options: LDOptions) {
    const fallbackLogger = new BasicLogger({
      level: 'info',
      // eslint-disable-next-line no-console
      destination: console.error,
      formatter: format,
    });

    const logger = options.logger ? new SafeLogger(options.logger, fallbackLogger) : fallbackLogger;
    const emitter = new EventEmitter();

    const pluginValidator = TypeValidators.createTypeArray('LDPlugin', {});
    const plugins: LDPlugin[] = [];
    if (options.plugins) {
      if (pluginValidator.is(options.plugins)) {
        plugins.push(...options.plugins);
      } else {
        logger.warn('Could not validate plugins.');
      }
    }

    const baseOptions = { ...options, logger };
    delete baseOptions.plugins;

    super(
      sdkKey,
      new NodePlatform({ ...options, logger }),
      baseOptions,
      {
        onError: (err: Error) => {
          if (emitter.listenerCount('error')) {
            emitter.emit('error', err);
          } else {
            logger.error(err.message);
          }
        },
        onFailed: (err: Error) => {
          emitter.emit('failed', err);
        },
        onReady: () => {
          emitter.emit('ready');
        },
        onUpdate: (key: string) => {
          emitter.emit('update', { key });
          emitter.emit(`update:${key}`, { key });
        },
        hasEventListeners: () =>
          emitter
            .eventNames()
            .some(
              (name) =>
                name === 'update' || (typeof name === 'string' && name.startsWith('update:')),
            ),
      },
      {
        getImplementationHooks: (environmentMetadata: LDPluginEnvironmentMetadata) =>
          internal.safeGetHooks(logger, environmentMetadata, plugins),
      },
    );

    this.emitter = emitter;
    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
      this.bigSegmentStatusProviderInternal,
    ) as BigSegmentStoreStatusProvider;

    internal.safeRegisterPlugins(logger, this.environmentMetadata, this, plugins);
  }

  // #region: EventEmitter

  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.on(eventName, listener);
    return this;
  }

  addListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.addListener(eventName, listener);
    return this;
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.once(eventName, listener);
    return this;
  }

  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.removeListener(eventName, listener);
    return this;
  }

  off(eventName: string | symbol, listener: (...args: any) => void): this {
    this.emitter.off(eventName, listener);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  setMaxListeners(n: number): this {
    this.emitter.setMaxListeners(n);
    return this;
  }

  getMaxListeners(): number {
    return this.emitter.getMaxListeners();
  }

  listeners(eventName: string | symbol): Function[] {
    return this.emitter.listeners(eventName);
  }

  rawListeners(eventName: string | symbol): Function[] {
    return this.emitter.rawListeners(eventName);
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.emitter.emit(eventName, args);
  }

  listenerCount(eventName: string | symbol): number {
    return this.emitter.listenerCount(eventName);
  }

  prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.prependListener(eventName, listener);
    return this;
  }

  prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.prependOnceListener(eventName, listener);
    return this;
  }

  eventNames(): (string | symbol)[] {
    return this.emitter.eventNames();
  }

  // #endregion
}

export default LDClientNode;
