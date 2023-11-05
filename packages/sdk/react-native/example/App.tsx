import { CLIENT_SIDE_SDK_KEY } from '@env';
import { useEffect } from 'react';
import EventSource from 'react-native-sse';

import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

type MyCustomEvents = 'patch' | 'put' | 'ping' | 'clientConnected' | 'clientDisconnected';

const featureClient = new ReactNativeLDClient(CLIENT_SIDE_SDK_KEY);
const context = { kind: 'user', key: 'test-user-1' };

const App = () => {
  useEffect(() => {
    const es = new EventSource<MyCustomEvents>(
      'https://clientstream.launchdarkly.com/meval/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
      {
        headers: { 'user-agent': 'NodeJSClient/1.1.1', authorization: CLIENT_SIDE_SDK_KEY },
      },
    );

    es.addEventListener('message', (event) => {
      console.log(event.type); // messages
      console.log(event.data);
    });

    es.addEventListener('put', (message: { data: any }) => {
      // console.log(message);
      console.log('------- put: ' + message.data);
    });
    es.addEventListener('patch', (message: { data: any }) => {
      // console.log(message);
      console.log('==== patch: ' + message.data);
    });

    es.addEventListener('error', (e: any) => console.error(e));
  }, []);
  return (
    <LDProvider client={featureClient} context={context}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
