import { Crypto } from './Crypto';
import { Encoding } from './Encoding';
import { Filesystem } from './Filesystem';
import { Info } from './Info';
import { Requests } from './Requests';
import { Storage } from './Storage';

export interface Platform {
  /**
   * The interface for performing encoding operations.
   */
  encoding?: Encoding;

  /**
   * The interface for getting information about the platform and the execution
   * environment.
   */
  info: Info;

  /**
   * The interface for performing file system operations. If the platform does
   * not support filesystem access, then this may be undefined.
   */
  fileSystem?: Filesystem;

  /**
   * The interface for performing cryptographic operations.
   */
  crypto: Crypto;

  /**
   * The interface for performing http/https requests.
   */
  requests: Requests;

  /**
   * The interface for session specific storage object. If the platform does not
   * support local storage access, this may be undefined.
   */
  storage?: Storage;
}
