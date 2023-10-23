import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useVariation } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const flag = useVariation('dev-test-flag');

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>{flag ? <>devTestFlag: {`${flag}`}</> : <>loading...</>}</Text>
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
