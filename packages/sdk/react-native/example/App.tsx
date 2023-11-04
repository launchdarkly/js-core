import { CLIENT_SIDE_SDK_KEY } from '@env';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  useEffect(() => {
    const startES = async () => {
      const response = await fetch(
        'https://clientstream.launchdarkly.com/meval/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
        {
          headers: {
            accept: 'text/event-stream',
            authorization: CLIENT_SIDE_SDK_KEY,
          },
        },
      );
      const j = await response.json();
      console.log(`===============${j}`);
    };

    startES()
      .then(() => console.log('finish startES'))
      .catch((e: any) => console.log(e));
  }, []);

  return (
    <View style={styles.container}>
      {/*<Text>{flag ? <>devTestFlag: {`${flag}`}</> : <>loading...</>}</Text>*/}
      <Text>hello</Text>
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
