# Changelog

All notable changes to the LaunchDarkly SDK for Cloudflare Workers will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org).

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 0.0.2 to 0.0.3

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.2 to 1.0.3

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.3 to 1.0.4

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.4 to 1.0.5

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.5 to 1.0.6

## [2.0.3](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v2.0.2...cloudflare-server-sdk-v2.0.3) (2023-05-01)


### Bug Fixes

* bump cloudflare sdk dep ([#115](https://github.com/launchdarkly/js-core/issues/115)) ([df9533f](https://github.com/launchdarkly/js-core/commit/df9533fc58ead31ed76a3e82a574daca7443d8f7))

## [2.0.2](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v2.0.1...cloudflare-server-sdk-v2.0.2) (2023-04-28)


### Bug Fixes

* fixed bug where the feature store does not deserialize KV values… ([#107](https://github.com/launchdarkly/js-core/issues/107)) ([68113b7](https://github.com/launchdarkly/js-core/commit/68113b7ac39f70a92b291eb2c0eda3b7d78145fc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.1 to 1.0.2

## [2.0.1](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v2.0.0...cloudflare-server-sdk-v2.0.1) (2023-04-27)


### Bug Fixes

* add licence and fix missing package.json fields. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))
* Ensure top level commands work correctly ([#105](https://github.com/launchdarkly/js-core/issues/105)) ([762571f](https://github.com/launchdarkly/js-core/commit/762571ff851558d229e4d29ba40a9c16b89f2a8d))
* remove beta text from cloudflare sdk readme. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.0 to 1.0.1

## [2.0.0](https://github.com/launchdarkly/js-core/compare/cloudflare-server-sdk-v0.0.4...cloudflare-server-sdk-v2.0.0) (2023-04-26)


### Features

* The latest version of this SDK supports LaunchDarkly's new custom contexts feature. Contexts are an evolution of a previously-existing concept, "users." Contexts let you create targeting rules for feature flags based on a variety of different information, including attributes pertaining to users, organizations, devices, and more. You can even combine contexts to create "multi-contexts." For detailed information about this version, please refer to the list below. For information on how to upgrade from the previous version, please read the [migration guide](https://docs.launchdarkly.com/sdk/server-side/cloudflare/migration-1-to-2).
* The latest version of this SDK replaces [launchdarkly-cloudflare-edge-sdk](https://github.com/launchdarkly/cloudflare-edge-sdk). Please consider updating your application to use this package instead.

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
