import Crypto from './Crypto';
import FileSystem from './FileSystem';
import Info from './Info';
import Requests from './Requests';

export default interface Platform {
  /**
   * The interface for getting information about the platform and the execution
   * environment.
   */
  info: Info;

  /**
   * The interface for performing file system operations. If the platform does
   * not support filesystem access, then this may be undefined.
   */
  fileSystem?:FileSystem;

  /**
   * The interface for performing cryptographic operations.
   */
  crypto: Crypto;

  /**
   * The interface for performing http/https requests.
   */
  requests: Requests
}
