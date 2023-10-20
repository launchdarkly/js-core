import { CLIENT_SIDE_SDK_KEY } from '@env';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import init, { type LDClientImpl } from '@launchdarkly/react-native-client-sdk';

const context = { kind: 'user', key: 'test-user-1' };

export default function App() {
  const [ldc, setLdc] = useState<LDClientImpl>();
  const [flag, setFlag] = useState<boolean>(false);

  useEffect(() => {
    init(CLIENT_SIDE_SDK_KEY, context)
      .then((c) => {
        setLdc(c);
      })
      .catch((e) => console.log(e));
  }, []);

  // useEffect(() => {
  //   const f = ldc?.boolVariation('dev-test-flag', false);
  //   setFlag(f ?? false);
  // }, [ldc]);

  return (
    <View style={styles.container}>
      <Text>hello</Text>
      <Text>{flag ? <>devTestFlag: {flag}</> : <>loading...</>}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
