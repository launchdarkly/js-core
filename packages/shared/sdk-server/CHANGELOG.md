# Changelog

All notable changes to `@launchdarkly/js-server-sdk-common` will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [1.2.3](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.2.2...js-server-sdk-common-v1.2.3) (2023-09-06)


### Bug Fixes

* Use clientSideAvailability instead of clientSide for filtering client side flags. ([#270](https://github.com/launchdarkly/js-core/issues/270)) ([2702342](https://github.com/launchdarkly/js-core/commit/27023429d36986466cda46aa4d95eb01c10cd455))

## [1.2.2](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.2.1...js-server-sdk-common-v1.2.2) (2023-08-28)


### Bug Fixes

* Client cannot become un-initialized. ([#251](https://github.com/launchdarkly/js-core/issues/251)) ([e2e8971](https://github.com/launchdarkly/js-core/commit/e2e8971fc1945a1121649ca84b752eb5d819aedd))
* Dispatch change events after ready event. ([#252](https://github.com/launchdarkly/js-core/issues/252)) ([2e2a865](https://github.com/launchdarkly/js-core/commit/2e2a8653671b7e7c814446ccb7ba696e301e81bb))

## [1.2.1](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.2.0...js-server-sdk-common-v1.2.1) (2023-08-24)


### Bug Fixes

* Fix an error handling situation that could cause double evaluation. ([#249](https://github.com/launchdarkly/js-core/issues/249)) ([2c613ff](https://github.com/launchdarkly/js-core/commit/2c613ffc8c6eea6e64495c63ec9dc079d1da619e))

## [1.2.0](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.1.0...js-server-sdk-common-v1.2.0) (2023-08-21)


### Features

* Optimize segment lookup for large segments. ([#235](https://github.com/launchdarkly/js-core/issues/235)) ([ac575d0](https://github.com/launchdarkly/js-core/commit/ac575d011d64f1833fc4c61bbbb7e4542b42e568))
* Use callbacks for evaluation hotpath. ([#234](https://github.com/launchdarkly/js-core/issues/234)) ([27e5454](https://github.com/launchdarkly/js-core/commit/27e54543f70e554eb452616f44ed19fbd9086bd2))


### Bug Fixes

* Correct double callback in persistent store wrapper. ([#240](https://github.com/launchdarkly/js-core/issues/240)) ([243729d](https://github.com/launchdarkly/js-core/commit/243729d258b81f71f88328fa0d406f3d5f3f1f80))

## [1.1.0](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.8...js-server-sdk-common-v1.1.0) (2023-08-14)


### Features

* Allow specifying the user agent per-sdk implementation. ([#226](https://github.com/launchdarkly/js-core/issues/226)) ([e57716f](https://github.com/launchdarkly/js-core/commit/e57716f3f6f0ba8568e32b0937903ca46e5470ad))


### Bug Fixes

* Allow for negation of segment match clauses. ([#237](https://github.com/launchdarkly/js-core/issues/237)) ([d8e469a](https://github.com/launchdarkly/js-core/commit/d8e469a5e58b90c791fbbee80f7c0fc447c4e42f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 1.0.3 to 1.1.0

## [1.0.8](https://github.com/launchdarkly/js-core/compare/js-server-sdk-common-v1.0.7...js-server-sdk-common-v1.0.8) (2023-08-10)


### Bug Fixes

* Switch to es2017 target to ensure native async/await. ([a83e4e6](https://github.com/launchdarkly/js-core/commit/a83e4e62d04c66105a1b0e8893640a7ca2d641e4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 1.0.2 to 1.0.3

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
