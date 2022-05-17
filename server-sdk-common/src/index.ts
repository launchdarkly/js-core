import Crypto from './platform/Crypto';
import FileSystem from './platform/FileSystem';
import Info from './platform/Info';
import Platform from './platform/Platform';
import Requests from './platform/Requests';

export {
  Crypto,
  FileSystem,
  Info,
  Platform,
  Requests,
};

export default function doesItWork() {
  console.log('yes');
}
