# Publishing SDKs

Publishing a new SDK package in this monorepo typically happens in 2
phases: initial package publishing phase and stable release phase.

> [!NOTE]
> If you are moving an existing package to this monorepo, you should
> still read through the [initial publishing](#initial-package-publishing)
> and follow the relevant steps to initialize the CI implementation.

## Initial Package Publishing

When publishing a package for the first time, developers must complete several steps not part of a typical package release. This phase is
designed to:
  1. Establish the CI implementation for the new package
  2. Generate pre-release builds for testing

### Step 1. Extend `release-please-config.json`

When doing the initial release, you will need to add a new record to
[`release-please-config.json`](../release-please-config.json):
```
"packages/type/my-package": {
  "bump-minor-pre-major": true,
  "release-as": "0.1.0",
  "bootstrap-sha": "MY_SHA"
}
```
> [!TIP]
> `bump-minor-pre-major` only needs to be set if you are publishing
> unstable releases (major version `0`). This option ensures that
> breaking changes will only increment minor version.

> [!TIP]
> `bootstrap-sha` will ensure that the conventional commits are
> calculated from a certain point and not the whole package history.
> You can find the appropriate commit sha using `git log`.

## 2. Add initial release manifest

Add the following to `.release-please-manifest.json`
```
"packages/type/my-package": "0.0.0"
```

## 3. Add option to manual workflows

Add `PATH_TO_YOUR_PACKAGE` to the `on.workflow_dispatch.inputs.workspace_path.options`
array in the following files:
- [`manual-publish-docs.yml`](../.github/workflows/manual-publish-docs.yml)
- [`manual-publish.yml`](../.github/workflows/manual-publish.yml)

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
> ![TIP]
> you should test your configuration on [your local machine](../.github/CI_CONTRIBUTING.md) if
> possible.

<!-- TODO document the stable release phase --->