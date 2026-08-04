# Changelog

## [4.0.0](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.5.0...node-client-sdk-v4.0.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* `identify()` resolves an identify result and no longer throws
* The on-disk persistent cache format changed; v3 cache data will not be read by v4 and the anonymous key will be regenerated on first identify.

### BREAKING-CHANGE

* The package name changed from `launchdarkly-node-client-sdk` to `@launchdarkly/node-client-sdk`. ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))


### Features

* `identify()` resolves an identify result and no longer throws ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Add useMobileKey option to NodeOptions ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Evaluation, identify, and track hooks ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Inspector support for flag and context state ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Plugin extension surface with `applicationInfo` metadata ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Runtime connection-mode control via `setConnectionMode` ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* Storage configuration with file-backed default and custom-implementation override ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* support client side secure mode with client side id ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* support wrapper header ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))
* TLS configuration via `tlsParams` ([4116d2f](https://github.com/launchdarkly/js-core/commit/4116d2f4cee34d0c2b8041b2b2a93a2a61820471))

## [0.5.0](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.4.3...node-client-sdk-v0.5.0) (2026-07-31)


### Features

* Add FDv2 data system support to NodeClient ([#1775](https://github.com/launchdarkly/js-core/issues/1775)) ([3ea0f33](https://github.com/launchdarkly/js-core/commit/3ea0f3398d25e8881775937a6ce2872242e4cbcc))

## [0.4.3](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.4.2...node-client-sdk-v0.4.3) (2026-07-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.30.0 to 1.30.1

## [0.4.2](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.4.1...node-client-sdk-v0.4.2) (2026-07-21)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.29.1 to 1.30.0

## [0.4.1](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.4.0...node-client-sdk-v0.4.1) (2026-06-29)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.29.0 to 1.29.1

## [0.4.0](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.3.0...node-client-sdk-v0.4.0) (2026-06-25)


### Features

* **node-client-sdk:** adding support for mobile usage ([#1768](https://github.com/launchdarkly/js-core/issues/1768)) ([71d47a7](https://github.com/launchdarkly/js-core/commit/71d47a70d303df349592a1573eb927d983673782))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.2.0...node-client-sdk-v0.3.0) (2026-06-22)


### Features

* **node-client-sdk:** adding ability to override storage implementation ([#1753](https://github.com/launchdarkly/js-core/issues/1753)) ([a04ec92](https://github.com/launchdarkly/js-core/commit/a04ec9215e069b7195c6e7aba21c09b39c607837))

## [0.2.0](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.1.0...node-client-sdk-v0.2.0) (2026-06-22)


### ⚠ BREAKING CHANGES

* pre-release `@launchdarkly/node-client-sdk` as `0.2.0` ([#1757](https://github.com/launchdarkly/js-core/issues/1757))

### Features

* pre-release `@launchdarkly/node-client-sdk` as `0.2.0` ([#1757](https://github.com/launchdarkly/js-core/issues/1757)) ([e14e6f9](https://github.com/launchdarkly/js-core/commit/e14e6f91148e1c7b65756cb653a45ebad883d1d6))

## [0.0.4](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.0.3...node-client-sdk-v0.0.4) (2026-06-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped to 1.29.0

## [0.0.3](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.0.2...node-client-sdk-v0.0.3) (2026-06-05)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped to 1.28.1

## [0.0.2](https://github.com/launchdarkly/js-core/compare/node-client-sdk-v0.0.1...node-client-sdk-v0.0.2) (2026-06-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped to 1.28.0

## Changelog

All notable changes to `@launchdarkly/node-client-sdk` will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).
