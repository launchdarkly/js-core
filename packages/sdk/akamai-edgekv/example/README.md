### Akamai Edge POC

This is an internal POC to see how compatible our js-core package is with Akamai's EW runtime.

## Getting started

1. Run the following command to install dependencies

```shell
npm install
```

2. Install the [Akamai CLI](https://github.com/akamai/cli)

```shell
brew install akamai
```

3. Follow [these instructions](https://techdocs.akamai.com/developer/docs/set-up-authentication-credentials) to add your credentials to the CLI.

4. Install the edgeworkers CLI package

```shell
akamai install edgeworkers
```

5. Install the sandbox CLI package

```shell
akamai install sandbox
```

6. Create a local sandbox

```shell
akamai sandbox create --property hello-akamai.dev.launchdarkly.com:15 --name <YOUR_NAME>CODING_SANDBOX
```

7. Transpile the code, create the bundle, and update the Sandbox client

```shell
npm run dev
```

8. Run the following command to test the EdgeWorker

```shell
curl -v -H 'Host: hello-akamai.dev.launchdarkly.com' -H 'Pragma: akamai-x-ew-debug'  http://127.0.0.1:9550/hello
```
