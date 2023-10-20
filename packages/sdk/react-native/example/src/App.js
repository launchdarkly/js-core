import { CLIENT_SIDE_SDK_KEY } from '@env';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import init, {} from '@launchdarkly/react-native-client-sdk';
const context = { kind: 'user', key: 'test-user-1' };
export default function App() {
    const [ldc, setLdc] = useState();
    const [flag, setFlag] = useState(false);
    useEffect(() => {
        init(CLIENT_SIDE_SDK_KEY, context).then((c) => {
            setLdc(c);
        });
    }, []);
    useEffect(() => {
        const f = ldc?.boolVariation('dev-test-flag', false);
        setFlag(f ?? false);
    }, [ldc]);
    return (React.createElement(View, { style: styles.container },
        React.createElement(Text, null, "hello"),
        React.createElement(Text, null, flag ? React.createElement(React.Fragment, null,
            "devTestFlag: ",
            flag) : React.createElement(React.Fragment, null, "loading..."))));
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
