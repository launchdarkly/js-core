# Creating pre-releases modules

The following steps are to create a pre release modules which would walk through the initial
CI work needed for new SDKs.

## 1. Extend `release-please-config.json`

Add a record of your new SDK package to `packages`
```
"PATH_TO_YOUR_PACKAGE": {
  "prerelease": true,
  "bump-minor-pre-major": true,
  "release-as": "0.1.0"
}
```
> NOTE: the `PATH_TO_YOUR_PACKAGE` needs to match the path in `package.json`
> eg `packages/sdk/server-node`

This is the minimum changes you need to do. `bump-minor-pre-major` option means only
minor version will be incremented while your package is in pre-release state.
> Pre-release packages **MUST** be in major version `0`

## 2. Add initial release manifest

Add the following to `.release-please-manifest.json`
```
"PATH_TO_YOUR_PACKAGE": "0.0.0"
```

## 3. Add option to manual workflows

Add `PATH_TO_YOUR_PACKAGE` to the `on.workflow_dispatch.inputs.workspace_path.options`
array in the following files:
- [`manual-publish-docs.yml`](./workflows/manual-publish-docs.yml)
- [`manual-publish.yml`](./workflows/manual-publish.yml)

## 4. Create a CI non-release workflow for just the project

You will add a file in the `.github/workflows` directory that tells GHA (mostly) how to
test your SDK. Below is a simple template to get started:
```
name: sdk/YOUR_SDK

on:
  push:
    branches: [main, 'feat/**']
    paths-ignore:
      - '**.md'
  pull_request:
    branches: [main, 'feat/**']
    paths-ignore:
      - '**.md'

jobs:
  build-test-YOUR_SDK:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          registry-url: 'https://registry.npmjs.org'
      - id: shared
        name: Shared CI Steps
        uses: ./actions/ci
        with:
          workspace_name: YOUR_PACKAGE_NAME
          workspace_path: PATH_TO_YOUR_PACKAGE
```
> NOTE: you should test your configuration on [your local machine](../.github/CI_CONTRIBUTING.md) if
> possible.