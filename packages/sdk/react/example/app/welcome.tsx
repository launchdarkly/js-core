'use client';

import { ChangeEvent, useState } from 'react';

// import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';

const styles = {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
  buttonContainer: {
    elevation: 8,
    backgroundColor: '#009688',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    alignSelf: 'center',
    textTransform: 'uppercase',
  },
};

export default function Welcome() {
  // const [flagKey] = useState('my-boolean-flag-1');
  const [userKey, setUserKey] = useState('');
  // const flagValue = useBoolVariation(flagKey, false);
  // const ldc = useLDClient();

  const onChangeUserKey = (e: ChangeEvent<HTMLInputElement>) => {
    setUserKey(e.target.value);
  };

  // const onIdentify = () => {
  //   ldc
  //     .identify({ kind: 'user', key: userKey })
  //     .catch((e: any) => console.error(`error identifying ${userKey}: ${e}`));
  // };
  //
  // const context = ldc.getContext() ?? 'No context identified.';

  return (
    <div style={styles.container}>
      <p>Welcome to LaunchDarkly</p>
      <input
        type="text"
        style={styles.input}
        autoCapitalize="none"
        onChange={onChangeUserKey}
        value={userKey}
      />
    </div>
  );
}
