# Changelog

All notable changes to `@launchdarkly/js-server-sdk-common` will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [1.0.7](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.6...js-server-sdk-common-v1.0.7) (2023-08-03)


### Bug Fixes

* Ensure that test data user targets are handled correctly. ([#223](https://github.com/launchdarkly/js-core/issues/223)) ([8a423b2](https://github.com/launchdarkly/js-core/commit/8a423b22282624627200dfda1ebe4207f9db69a6))

## [1.0.6](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.5...js-server-sdk-common-v1.0.6) (2023-07-05)


### Bug Fixes

* Preserve fallthrough variation when cloning test data. ([#194](https://github.com/launchdarkly/js-core/issues/194)) ([e9cf09d](https://github.com/launchdarkly/js-core/commit/e9cf09d21adb06e2893c6bb369b3c430c7a26a88))

## [1.0.5](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.4...js-server-sdk-common-v1.0.5) (2023-06-27)


### Bug Fixes

* Set the content type when posting events. ([#184](https://github.com/launchdarkly/js-core/issues/184)) ([dc9e921](https://github.com/launchdarkly/js-core/commit/dc9e921ce359f9e22e645c2a3696e2dd1a963635))

## [1.0.4](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.3...js-server-sdk-common-v1.0.4) (2023-06-13)


### Bug Fixes

* Correctly handle excluded big segments. ([#160](https://github.com/launchdarkly/js-core/issues/160)) ([e9cb45a](https://github.com/launchdarkly/js-core/commit/e9cb45a14ed6d3f931680dab0feb4b5cef350592))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 1.0.1 to 1.0.2

## [1.0.3](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.2...js-server-sdk-common-v1.0.3) (2023-06-08)


### Bug Fixes

* Export PersistentDataStoreWrapper. ([#144](https://github.com/launchdarkly/js-core/issues/144)) ([2c2480d](https://github.com/launchdarkly/js-core/commit/2c2480d4d5cd6adf7ae276758fcf0a1cdcdd9a00))

## [1.0.2](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.1...js-server-sdk-common-v1.0.2) (2023-04-28)


### Bug Fixes

* fixed bug where the feature store does not deserialize KV values… ([#107](https://github.com/launchdarkly/js-core/issues/107)) ([68113b7](https://github.com/launchdarkly/js-core/commit/68113b7ac39f70a92b291eb2c0eda3b7d78145fc))

## [1.0.1](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.0...js-server-sdk-common-v1.0.1) (2023-04-27)


### Bug Fixes

* add licence and fix missing package.json fields. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))
* Ensure top level commands work correctly ([#105](https://github.com/launchdarkly/js-core/issues/105)) ([762571f](https://github.com/launchdarkly/js-core/commit/762571ff851558d229e4d29ba40a9c16b89f2a8d))
* remove beta text from cloudflare sdk readme. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 1.0.0 to 1.0.1

## [1.0.0](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v0.3.1...js-server-sdk-common-v1.0.0) (2023-04-26)


### Features

* initial major release ([#101](https://github.com/launchdarkly/js-core/issues/101)) ([9883675](https://github.com/launchdarkly/js-core/commit/98836758d1998f208a1e13a68955611e0b10a8ce))

## [0.3.1](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v0.3.0...js-server-sdk-common-v0.3.1) (2023-04-20)


### Bug Fixes

* semver util import error ([#90](https://github.com/launchdarkly/js-core/issues/90)) ([b70015a](https://github.com/launchdarkly/js-core/commit/b70015a86b460e8cdc3ee4fff8b339955bd95099))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v0.2.0...js-server-sdk-common-v0.3.0) (2023-04-19)


### Features

* cloudflare sdk base ([#74](https://github.com/launchdarkly/js-core/issues/74)) ([add0c63](https://github.com/launchdarkly/js-core/commit/add0c6312c253752d2766cfd499b5134e87a17fb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 0.2.0 to 0.3.0

## [0.2.0](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v0.1.0...js-server-sdk-common-v0.2.0) (2023-03-16)


### Features

* Update packaging to include only needed files. ([06b2f28](https://github.com/launchdarkly/js-core/commit/06b2f28c85ba9e8610f88cb234546403e534fa77))

## 0.1.0 (2023-03-15)

Initial prerelease version.
