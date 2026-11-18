# Contributing to shared packages

See [Contributing](../CONTRIBUTING.md) for basic information about contributing to this repository.

# Requirements for shared packages

Shared packages are intended to run in many different execution environments. These could include browser, node, as well as custom runtime environments for edge compute providers. As such platform APIs should be avoided to prevent the needed for complicated polyfill configurations and increased code side.

The code should be written in pure JavaScript without any dependence on specific platform APIs. The `common` SDK package contains a platform abstraction for which should be used in place of any platform APIs.
