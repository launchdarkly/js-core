import { Options } from '../../api/platform/Requests';

/**
 * Converts the request options into the init shape a platform's native `fetch` accepts. A
 * platform can declare its `AbortSignal` as a lexical class, which `AbortSignalLike`
 * cannot resolve to, so the `signal` member widens here. The caller must pass a signal
 * created by the running platform. The widening then only restores the type the runtime
 * already has.
 */
export function toRequestInit(options: Options): Omit<Options, 'signal'> & { signal?: any } {
  return options;
}
