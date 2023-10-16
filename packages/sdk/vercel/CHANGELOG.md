# Changelog

All notable changes to the LaunchDarkly SDK for Vercel Edge Config will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org).

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 2.0.0 to 2.0.1

## [1.1.5](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v1.1.4...vercel-server-sdk-v1.1.5) (2023-10-16)

### Features:
- A new `Migration` type which provides an out-of-the-box configurable migration framework.
- For more advanced use cases, added new `migrationVariation` and `trackMigration` methods on LdClient.
- Added typed variation method `boolVariation`, `stringVariation`, `boolVariation`, `numVariation`, and `jsonVariation` for type-safe usage in TypeScript.

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.13 to 2.0.0

## [1.1.4](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v1.1.3...vercel-server-sdk-v1.1.4) (2023-09-06)

### Bug Fixes

* Use clientSideAvailability instead of clientSide for filtering client side flags. ([#270](https://github.com/launchdarkly/js-core/issues/270)) ([2702342](https://github.com/launchdarkly/js-core/commit/27023429d36986466cda46aa4d95eb01c10cd455))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.10 to 1.0.11

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.12 to 1.0.13

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.11 to 1.0.12

## [1.1.1](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v1.1.1...vercel-server-sdk-v1.1.1) (2023-08-14)

Updated common dependency includes performance improvements.

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.9 to 1.0.10

## [1.1.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v1.0.2...vercel-server-sdk-v1.1.0) (2023-08-14)


### Features

* Allow specifying the user agent per-sdk implementation. ([#226](https://github.com/launchdarkly/js-core/issues/226)) ([e57716f](https://github.com/launchdarkly/js-core/commit/e57716f3f6f0ba8568e32b0937903ca46e5470ad))


### Bug Fixes

* Allow for negation of segment match clauses. ([#237](https://github.com/launchdarkly/js-core/issues/237)) ([d8e469a](https://github.com/launchdarkly/js-core/commit/d8e469a5e58b90c791fbbee80f7c0fc447c4e42f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.8 to 1.0.9


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

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.6 to 1.0.7

## [1.0.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v1.0.2...vercel-server-sdk-v1.0.0) (2023-08-10)


### Bug Fixes

* Switch to es2017 target to ensure native async/await. ([a83e4e6](https://github.com/launchdarkly/js-core/commit/a83e4e62d04c66105a1b0e8893640a7ca2d641e4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.7 to 1.0.8

## [1.0.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.4.4...vercel-server-sdk-v1.0.0) (2023-06-28)


### Features

* Vercel 1.0.0 ([#177](https://github.com/launchdarkly/js-core/issues/177)) ([78daeaf](https://github.com/launchdarkly/js-core/commit/78daeaf566957075c823600a03f8475bebd4dbdb))

## [0.4.1](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.4.0...vercel-server-sdk-v0.4.1) (2023-06-07)


### Bug Fixes

* avoid modifying req.nextUrl ([#142](https://github.com/launchdarkly/js-core/issues/142)) ([49329d2](https://github.com/launchdarkly/js-core/commit/49329d2f142b83bc79361cd5b22c438f78a197b5))

## [0.4.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.3.0...vercel-server-sdk-v0.4.0) (2023-06-02)


### Features

* add new Vercel example ([#130](https://github.com/launchdarkly/js-core/issues/130)) ([d25f327](https://github.com/launchdarkly/js-core/commit/d25f327d9364ff3748e364426d9d6cfd83223bcf))
* update Vercel example ([#129](https://github.com/launchdarkly/js-core/issues/129)) ([2296c4f](https://github.com/launchdarkly/js-core/commit/2296c4f8ad1febc3bd22c2272fcefebaf8d4cce6))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.2.2...vercel-server-sdk-v0.3.0) (2023-05-16)


### Features

* Use version number from release process instead of package.json. ([#119](https://github.com/launchdarkly/js-core/issues/119)) ([9a5dcb8](https://github.com/launchdarkly/js-core/commit/9a5dcb8ef62756e278637c7e749cf2b204218d4a))

## [0.2.2](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.2.1...vercel-server-sdk-v0.2.2) (2023-04-28)


### Bug Fixes

* make vercel use EdgeProvider ([#114](https://github.com/launchdarkly/js-core/issues/114)) ([6705996](https://github.com/launchdarkly/js-core/commit/6705996929471ff8f72f97d58a665f75d4e5fecd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.1 to 1.0.2

## [0.2.1](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.2.0...vercel-server-sdk-v0.2.1) (2023-04-27)


### Bug Fixes

* add licence and fix missing package.json fields. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))
* remove beta text from cloudflare sdk readme. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 1.0.0 to 1.0.1

## [0.2.0](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.1.1...vercel-server-sdk-v0.2.0) (2023-04-26)


### Features

* initial major release ([#101](https://github.com/launchdarkly/js-core/issues/101)) ([9883675](https://github.com/launchdarkly/js-core/commit/98836758d1998f208a1e13a68955611e0b10a8ce))

## [0.1.1](https://github.com/launchdarkly/js-core/compare/vercel-server-sdk-v0.1.0...vercel-server-sdk-v0.1.1) (2023-04-26)


### Bug Fixes

* fix packagejson import ([#98](https://github.com/launchdarkly/js-core/issues/98)) ([4dd4ec5](https://github.com/launchdarkly/js-core/commit/4dd4ec5a9e5a777462e06d91c735b487308da967))

## 0.1.0 (2023-04-25)


### Features

* vercel edge sdk ([#77](https://github.com/launchdarkly/js-core/issues/77)) ([5f5eda3](https://github.com/launchdarkly/js-core/commit/5f5eda3fddc6c25d00cd0d24c6351d6c790e4592))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-server-sdk-common-edge bumped from 0.0.2 to 0.0.3
