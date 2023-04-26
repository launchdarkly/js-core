# Changelog

All notable changes to the LaunchDarkly SDK for Cloudflare Workers will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org).

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 0.0.2 to 0.0.3

## [2.0.0](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v0.0.4...cloudflare-server-sdk-v2.0.0) (2023-04-26)


### Features

* The latest version of this SDK supports LaunchDarkly's new custom contexts feature. Contexts are an evolution of a previously-existing concept, "users." Contexts let you create targeting rules for feature flags based on a variety of different information, including attributes pertaining to users, organizations, devices, and more. You can even combine contexts to create "multi-contexts." For detailed information about this version, please refer to the list below. For information on how to upgrade from the previous version, please read the [migration guide](https://docs.launchdarkly.com/sdk/server-side/cloudflare/migration-1-to-2).
* The latest version of this SDK is a replacement of [launchdarkly-cloudflare-edge-sdk](https://github.com/launchdarkly/cloudflare-edge-sdk). That repo will no longer be maintained and will be removed soon. Please consider updating your application to use this package instead.

## [0.0.4](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v0.0.3...cloudflare-server-sdk-v0.0.4) (2023-04-26)


### Bug Fixes

* Improve readme. ([50d8556](https://github.com/launchdarkly/js-core/commit/50d85561c5f7577e1ecdc64f919d753c5df66b39))

## [0.0.2](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v0.0.1...cloudflare-server-sdk-v0.0.2) (2023-04-20)


### Bug Fixes

* semver util import error ([#90](https://github.com/launchdarkly/js-core/issues/90)) ([b70015a](https://github.com/launchdarkly/js-core/commit/b70015a86b460e8cdc3ee4fff8b339955bd95099))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 0.0.1 to 0.0.2

## 0.0.1 (2023-04-19)


### Features

* cloudflare sdk base ([#74](https://github.com/launchdarkly/js-core/issues/74)) ([add0c63](https://github.com/launchdarkly/js-core/commit/add0c6312c253752d2766cfd499b5134e87a17fb))
* create sdk-server-edge package ([#83](https://github.com/launchdarkly/js-core/issues/83)) ([0578190](https://github.com/launchdarkly/js-core/commit/0578190123e2712b50774ca3087c7577ef2b9eb2))
* fix typedoc and export common types ([#81](https://github.com/launchdarkly/js-core/issues/81)) ([daefb60](https://github.com/launchdarkly/js-core/commit/daefb60fb63ac9d2ebd4fea0fadaa0263b0b84ae))
* support cjs and esm for cloudflare and edge common ([#87](https://github.com/launchdarkly/js-core/issues/87)) ([bab593c](https://github.com/launchdarkly/js-core/commit/bab593cdd9ff8e8881259a21f24c35088e7092bc))

## [1.0.0] - 2022-10-13

Bump `launchdarkly-node-server-sdk` and move SDK out of beta.

## [0.1.1] - 2022-07-07

Fix TypeScript definition

## [0.1.0] - 2021-10-19

This is the first public release of the LaunchDarkly Cloudflare Edge SDK. The SDK is considered to be unsupported and in beta until release 1.0.0.
