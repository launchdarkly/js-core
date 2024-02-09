# LaunchDarkly Github Actions for JavaScript SDKs.

This directory contains Github Actions for building, deploying, releasing 
libraries in this monorepo.

## Local testing using act

You can use [act](https://nektosact.com/usage/index.html) to run github actions locally for testing.

1. Install and run Docker.
2. Install act

```shell
brew install act
```

3. Run a workflow file.

```shell
# To run the react-native build/test/e2e
act -W '.github/workflows/react-native.yml' -P macos-latest=-self-hosted
```
