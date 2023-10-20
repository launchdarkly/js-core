import { name, version } from '../package.json';
import { btoa } from './utils';
class PlatformRequests {
    createEventSource(_url, _eventSourceInitDict) {
        throw new Error('todo');
    }
    fetch(url, options) {
        return fetch(url, options);
    }
}
class PlatformEncoding {
    btoa(data) {
        return btoa(data);
    }
}
class PlatformInfo {
    platformData() {
        return {
            name: 'React Native',
        };
    }
    sdkData() {
        return {
            name,
            version,
            userAgentBase: 'ReactNativeClient',
        };
    }
}
// @ts-ignore
const platform = {
    info: new PlatformInfo(),
    requests: new PlatformRequests(),
    encoding: new PlatformEncoding(),
};
export default platform;
