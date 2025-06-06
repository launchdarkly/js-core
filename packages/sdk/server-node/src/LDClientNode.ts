// eslint-disable-next-line max-classes-per-file
import { EventEmitter } from 'events';
import { format } from 'util';

import {
  BasicLogger,
  internal,
  LDClientImpl,
  LDPluginEnvironmentMetadata,
  Platform,
  SafeLogger,
  TypeValidators,
} from '@launchdarkly/js-server-sdk-common';
import { LDClientCallbacks } from '@launchdarkly/js-server-sdk-common/dist/LDClientImpl';
import { ServerInternalOptions } from '@launchdarkly/js-server-sdk-common/dist/options/ServerInternalOptions';

import { BigSegmentStoreStatusProvider, LDClient } from './api';
import { LDOptions } from './api/LDOptions';
import { LDPlugin } from './api/LDPlugin';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { Emits } from './Emits';
import NodePlatform from './platform/NodePlatform';

/**
 * @internal
 * Extend the base client implementation with an event emitter.
 *
 * The LDClientNode implementation must satisfy the LDClient interface,
 * which is why we extend the base client implementation with an event emitter
 * and then inherit from that. This adds everything we need to the implementation
 * to comply with the interface.
 *
 * This allows re-use of the `Emits` mixin for this and big segments.
 */
class ClientBaseWithEmitter extends LDClientImpl {
  emitter: EventEmitter;

  constructor(
    sdkKey: string,
    platform: Platform,
    options: LDOptions,
    callbacks: LDClientCallbacks,
    internalOptions?: ServerInternalOptions,
  ) {
    super(sdkKey, platform, options, callbacks, internalOptions);
    this.emitter = new EventEmitter();
  }
}

/**
 * @ignore
 */
class LDClientNode extends Emits(ClientBaseWithEmitter) implements LDClient {
  bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

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

    super(
      sdkKey,
      new NodePlatform({ ...options, logger }),
      { ...options, logger },
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
    // TODO: It would be good if we could re-arrange this emitter situation so we don't have to
    // create two emitters. It isn't harmful, but it isn't ideal.
    this.emitter = emitter;

    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
      this.bigSegmentStatusProviderInternal,
    ) as BigSegmentStoreStatusProvider;

    internal.safeRegisterPlugins(logger, this.environmentMetadata, this, plugins);
  }
}

export default LDClientNode;
