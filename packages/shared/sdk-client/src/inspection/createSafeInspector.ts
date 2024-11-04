import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';
import { inspectorMethodError } from './messages';

/**
 * Wrap an inspector ensuring that calling its methods are safe.
 * @param inspector Inspector to wrap.
 */
export default function createSafeInspector(
  inspector: LDInspection,
  logger: LDLogger,
): LDInspection {
  let errorLogged = false;
  const wrapper: LDInspection = {
    method: (...args: any[]) => {
      try {
        // We are proxying arguments here to the underlying method. Typescript doesn't care
        // for this as it cannot validate the parameters are correct, but we are also the caller
        // in this case and will dispatch things with the correct arguments. The dispatch to this
        // will itself happen with a type guard.
        // @ts-ignore
        inspector.method(...args);
      } catch {
        // If something goes wrong in an inspector we want to log that something
        // went wrong. We don't want to flood the logs, so we only log something
        // the first time that something goes wrong.
        // We do not include the exception in the log, because we do not know what
        // kind of data it may contain.
        if (!errorLogged) {
          errorLogged = true;
          logger.warn(inspectorMethodError(wrapper.type, wrapper.name));
        }
        // Prevent errors.
      }
    },
    type: inspector.type,
    name: inspector.name,
    synchronous: inspector.synchronous,
  };

  return wrapper;
}
