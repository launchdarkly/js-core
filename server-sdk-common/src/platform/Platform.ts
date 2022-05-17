import FileSystem from './FileSystem';
import Info from './Info';

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
}
