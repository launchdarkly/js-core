# Contributing to the monorepo for JavaScript SDKs

LaunchDarkly has published an [SDK contributor's guide](https://docs.launchdarkly.com/sdk/concepts/contributors-guide) that provides a detailed explanation of how our SDKs work. See below for additional information on how to contribute to this SDK.

## Submitting bug reports and feature requests

The LaunchDarkly SDK team monitors the [issue tracker](https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc) in the SDK repository. Bug reports and feature requests specific to this SDK should be filed in this issue tracker. The SDK team will respond to all newly filed issues within two business days.

## Submitting pull requests

We encourage pull requests and other contributions from the community. Before submitting pull requests, ensure that all temporary or unintended code is removed. Don't worry about adding reviewers to the pull request; the LaunchDarkly SDK team will add themselves. The SDK team will acknowledge all pull requests within two business days.

## Build instructions

### Prerequisites

A node environment of version 16 and npm or yarn are required to develop in this repository.

This monorepo may contain projects that are not suitable for execution using node, and those
projects will have specific environment prerequisites.

### Setup

To install project dependencies, from the project root directory:

```
yarn
```

### Build

To build all projects, from the root directory:

```
yarn build
```

### Testing

Unit tests should be implemented in a `__tests__` folder in the root of the package. The directory structure inside of `__tests__` should mirror that of the source directory.

Each package has its own testing requirements and tests should be only ran for single projects.

To run the SDK contract test suite (see [`contract-tests/README.md`](./contract-tests/README.md)):
The SDK contract test suite will run the Node.js Server version of the SDK.

```bash
yarn run contract-tests
```
