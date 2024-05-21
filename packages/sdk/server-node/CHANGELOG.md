# Changelog

All notable changes to `@launchdarkly/node-server-sdk` will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [8.2.6](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.5...node-server-sdk-v8.2.6) (2024-05-21)


### Bug Fixes

* Configure max backoff and jitter ratio to ensure exponential backoff. ([#464](https://github.com/launchdarkly/js-core/issues/464)) ([87563cb](https://github.com/launchdarkly/js-core/commit/87563cb516c42da921f8a52790b935d672c5107c))

## [8.2.5](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.4...node-server-sdk-v8.2.5) (2024-02-12)


### Bug Fixes

* Fix an issue where failed http requests could cause an unhandled promise rejection. ([#374](https://github.com/launchdarkly/js-core/issues/374)) ([ecfd2db](https://github.com/launchdarkly/js-core/commit/ecfd2dbe11ff59d12e715106b4e84808dfd51b09))

## [8.2.4](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.3...node-server-sdk-v8.2.4) (2023-09-06)

### Bug Fixes

* Use clientSideAvailability instead of clientSide for filtering client side flags. ([#270](https://github.com/launchdarkly/js-core/issues/270)) ([2702342](https://github.com/launchdarkly/js-core/commit/27023429d36986466cda46aa4d95eb01c10cd455))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.2.2 to 1.2.3

## [8.2.3](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.2...node-server-sdk-v8.2.3) (2023-08-28)

## Fixes:
* Upgraded to `launchdarkly-eventsource` version `2.0.1`. This includes a fix for the buffer pre-allocation algorithm and handling partial messages.
* Ensure that flag `update` events are dispatched after the SDK `ready` event.
* Fix an issue that could cause the SDK log warnings about usage before initialization after an error handling a flag update.

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.2.1 to 1.2.2

## [8.2.2](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.1...node-server-sdk-v8.2.2) (2023-08-24)

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.2.0 to 1.2.1

## [8.2.1](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.2.0...node-server-sdk-v8.2.1) (2023-08-14)

Updated common dependency includes performance improvements.

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.1.0 to 1.2.0

## [8.2.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.1.2...node-server-sdk-v8.2.0) (2023-08-14)


### Features

* Allow specifying the user agent per-sdk implementation. ([#226](https://github.com/launchdarkly/js-core/issues/226)) ([e57716f](https://github.com/launchdarkly/js-core/commit/e57716f3f6f0ba8568e32b0937903ca46e5470ad))

### Bug Fixes

* Allow for negation of segment match clauses. ([#237](https://github.com/launchdarkly/js-core/issues/237)) ([d8e469a](https://github.com/launchdarkly/js-core/commit/d8e469a5e58b90c791fbbee80f7c0fc447c4e42f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.8 to 1.1.0

## [8.1.2](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.1.1...node-server-sdk-v8.1.2) (2023-08-10)


### Bug Fixes

* Switch to es2017 target to ensure native async/await. ([a83e4e6](https://github.com/launchdarkly/js-core/commit/a83e4e62d04c66105a1b0e8893640a7ca2d641e4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.7 to 1.0.8

## [8.1.1](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.1.0...node-server-sdk-v8.1.1) (2023-08-03)

### Bug Fixes

* Ensure that test data user targets are handled correctly. ([#223](https://github.com/launchdarkly/js-core/issues/223)) ([8a423b2](https://github.com/launchdarkly/js-core/commit/8a423b22282624627200dfda1ebe4207f9db69a6))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.6 to 1.0.7

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 0.2.0 to 0.3.0

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 0.3.0 to 0.3.1

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.1 to 1.0.2

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.2 to 1.0.3

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.4 to 1.0.5

## [8.1.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.0.2...node-server-sdk-v8.1.0) (2023-07-05)


### Features

* Update to launchdarkly-eventsource 2.0.0. ([#199](https://github.com/launchdarkly/js-core/issues/199)) ([5b7bac9](https://github.com/launchdarkly/js-core/commit/5b7bac9d864d7e7e5204131eae7612fc982e941e))

## [8.0.2](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v8.0.1...node-server-sdk-v8.0.2) (2023-07-05)


### Bug Fixes

* move "default" conditional exports to be last ([#190](https://github.com/launchdarkly/js-core/issues/190)) ([49ca1a1](https://github.com/launchdarkly/js-core/commit/49ca1a1d47595b2c3ef449054ba6d76a8685a590)) (Thanks, [seanparmelee](https://github.com/launchdarkly/js-core/pull/190) and [Katona](https://github.com/launchdarkly/js-core/pull/191)!)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.5 to 1.0.6

## [8.0.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.5.0...node-server-sdk-v8.0.0) (2023-06-26)

### Introducing `@launchdarkly/node-server-sdk` as a replacement for `launchdarkly-node-server-sdk`.

* The SDK has been re-written in Typescript.
* The SDK has been moved to a new [repository](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-node) in github.
* The SDK has a new [package name](https://www.npmjs.com/package/@launchdarkly/node-server-sdk).

### Features

* Node server SDK major release. ([#180](https://github.com/launchdarkly/js-core/issues/180)) ([2e02f72](https://github.com/launchdarkly/js-core/commit/2e02f72ec43e86fb203d32742b78a8e4a905a114))

## [0.5.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.4.4...node-server-sdk-v0.5.0) (2023-06-15)


### Features

* Allow imports from paths. ([#162](https://github.com/launchdarkly/js-core/issues/162)) ([0f8f601](https://github.com/launchdarkly/js-core/commit/0f8f601fb6b35e5e677c93c95f1bb70d53afc84f))

## [0.4.4](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.4.3...node-server-sdk-v0.4.4) (2023-06-13)


### Bug Fixes

* Correctly handle excluded big segments. ([#160](https://github.com/launchdarkly/js-core/issues/160)) ([e9cb45a](https://github.com/launchdarkly/js-core/commit/e9cb45a14ed6d3f931680dab0feb4b5cef350592))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.3 to 1.0.4

## [0.4.1](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.4.0...node-server-sdk-v0.4.1) (2023-04-27)


### Bug Fixes

* add licence and fix missing package.json fields. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))
* Ensure top level commands work correctly ([#105](https://github.com/launchdarkly/js-core/issues/105)) ([762571f](https://github.com/launchdarkly/js-core/commit/762571ff851558d229e4d29ba40a9c16b89f2a8d))
* remove beta text from cloudflare sdk readme. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common bumped from 1.0.0 to 1.0.1

## [0.4.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.3.2...node-server-sdk-v0.4.0) (2023-04-26)


### Features

* Updates common package dep to 1.0.0 ([#101](https://github.com/launchdarkly/js-core/issues/101)) ([9883675](https://github.com/launchdarkly/js-core/commit/98836758d1998f208a1e13a68955611e0b10a8ce))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.2.0...node-server-sdk-v0.3.0) (2023-03-16)


### ⚠ BREAKING CHANGES

* Make options optional in init method for @launchdarkly/node-server-sdk. ([#64](https://github.com/launchdarkly/js-core/issues/64))

### Bug Fixes

* Make options optional in init method for @launchdarkly/node-server-sdk. ([#64](https://github.com/launchdarkly/js-core/issues/64)) ([291804e](https://github.com/launchdarkly/js-core/commit/291804e75119f42575615569c974c0813453d737))

## [0.2.0](https://github.com/launchdarkly/js-core/compare/node-server-sdk-v0.1.0...node-server-sdk-v0.2.0) (2023-03-16)


### Features

* Update packaging to include only needed files. ([06b2f28](https://github.com/launchdarkly/js-core/commit/06b2f28c85ba9e8610f88cb234546403e534fa77))

## 0.1.0 (2023-03-15)

Initial prerelease version.
