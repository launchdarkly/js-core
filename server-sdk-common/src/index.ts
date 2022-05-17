import Crypto from './platform/Crypto';
import Filesystem from './platform/Filesystem';
import Info from './platform/Info';
import Platform from './platform/Platform';
import Requests from './platform/Requests';

export {
  Crypto,
  Filesystem as FileSystem,
  Info,
  Platform,
  Requests,
};

export default function doesItWork() {
  console.log('yes');
}
