# Changelog

## [1.6.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.5.0...js-client-sdk-common-v1.6.0) (2024-08-28)


### Features

* Correct client evaluation typings. ([#554](https://github.com/launchdarkly/js-core/issues/554)) ([64ab88d](https://github.com/launchdarkly/js-core/commit/64ab88d278308564b4cd7b6433870c7adb09142a))
* Make timeout optional in LDIdentifyOptions. ([#552](https://github.com/launchdarkly/js-core/issues/552)) ([fa247b2](https://github.com/launchdarkly/js-core/commit/fa247b2db821d11c8360752ba5f28b4ecff493c7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.6.0 to 2.7.0

## [1.5.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.4.0...js-client-sdk-common-v1.5.0) (2024-08-19)


### Features

* Allow waiting for the network response on identify. ([#548](https://github.com/launchdarkly/js-core/issues/548)) ([1375660](https://github.com/launchdarkly/js-core/commit/1375660afe39204205344e62ffc1ba3fbcce3950))

## [1.4.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.3.0...js-client-sdk-common-v1.4.0) (2024-08-15)


### Features

* Remove event target shim. ([#545](https://github.com/launchdarkly/js-core/issues/545)) ([448ad67](https://github.com/launchdarkly/js-core/commit/448ad67815b9ec29abd322ed8483b2367147b146)), closes [#412](https://github.com/launchdarkly/js-core/issues/412)

## [1.3.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.2.0...js-client-sdk-common-v1.3.0) (2024-08-12)


### Features

* Add connection mananger. ([#522](https://github.com/launchdarkly/js-core/issues/522)) ([5bf8b16](https://github.com/launchdarkly/js-core/commit/5bf8b16e26e7d8cbbd18524f1c13f773de457b82))
* Implement polling support. ([#524](https://github.com/launchdarkly/js-core/issues/524)) ([a99048e](https://github.com/launchdarkly/js-core/commit/a99048e0cebaafd536f79114c4727524b8f7357d))
* Refactor application state handling. ([#523](https://github.com/launchdarkly/js-core/issues/523)) ([f5b81e6](https://github.com/launchdarkly/js-core/commit/f5b81e6fc571dc9d97a18d07f382c77cd938fd65))
* refactors the implementation of context caching.  You can now s… ([#531](https://github.com/launchdarkly/js-core/issues/531)) ([8ab2ee4](https://github.com/launchdarkly/js-core/commit/8ab2ee425a35350a4f1c50e608c39fa3527da513))


### Bug Fixes

* Fix field visibility. ([#530](https://github.com/launchdarkly/js-core/issues/530)) ([21fb18b](https://github.com/launchdarkly/js-core/commit/21fb18b40139583b44a4185fb689b043547641ab))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.5.0 to 2.6.0

## [1.2.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.5...js-client-sdk-common-v1.2.0) (2024-07-31)


### Features

* Remove mock fetch from mocks. ([#525](https://github.com/launchdarkly/js-core/issues/525)) ([fa8e579](https://github.com/launchdarkly/js-core/commit/fa8e579b150770721347a173b4a65b3102d6b347))

## [1.1.5](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.4...js-client-sdk-common-v1.1.5) (2024-07-12)


### Bug Fixes

* Correct documentation for variationDetail for client SDKs. ([#509](https://github.com/launchdarkly/js-core/issues/509)) ([496e39f](https://github.com/launchdarkly/js-core/commit/496e39f54a4437866dd1ab4050fd5522cfc78f23))

## [1.1.4](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.3...js-client-sdk-common-v1.1.4) (2024-06-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.4.2 to 2.5.0

## [1.1.3](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.2...js-client-sdk-common-v1.1.3) (2024-04-26)


### Bug Fixes

* Produce a warning when track is called with a non-numeric metric value. ([#449](https://github.com/launchdarkly/js-core/issues/449)) ([6799742](https://github.com/launchdarkly/js-core/commit/6799742a7914d32b3313e54408f0a2a3dda3ff5c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.4.1 to 2.4.2

## [1.1.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.1...js-client-sdk-common-v1.1.2) (2024-04-25)


### Bug Fixes

* Adjust identify timeout message. ([#447](https://github.com/launchdarkly/js-core/issues/447)) ([7fc4f2f](https://github.com/launchdarkly/js-core/commit/7fc4f2fab7faab4d3b969044e6e9524c59af69d9))

## [1.1.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.1.0...js-client-sdk-common-v1.1.1) (2024-04-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.4.0 to 2.4.1

## [1.1.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.0.3...js-client-sdk-common-v1.1.0) (2024-04-09)


### Features

* Add identify timeout to client-sdk. ([#420](https://github.com/launchdarkly/js-core/issues/420)) ([5d73dfe](https://github.com/launchdarkly/js-core/commit/5d73dfeb0d5cdacf620e65e214dd2e334363490e))


### Bug Fixes

* Identify incorrectly rejected in client-sdk ([#426](https://github.com/launchdarkly/js-core/issues/426)) ([a019dd6](https://github.com/launchdarkly/js-core/commit/a019dd66b1b852d888e10b78aec9693d7de195fe))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.3.1 to 2.4.0

## [1.0.3](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.0.2...js-client-sdk-common-v1.0.3) (2024-03-25)


### Bug Fixes

* Send identify event. ([#407](https://github.com/launchdarkly/js-core/issues/407)) ([1d73462](https://github.com/launchdarkly/js-core/commit/1d73462914cd35925d34a84b61492a52406b4083))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.3.0 to 2.3.1

## [1.0.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.0.1...js-client-sdk-common-v1.0.2) (2024-03-15)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.2.0 to 2.3.0

## [1.0.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.0.0...js-client-sdk-common-v1.0.1) (2024-03-05)


### Bug Fixes

* Bug in sdk-client where withReasons was not passed to streamer. ([#387](https://github.com/launchdarkly/js-core/issues/387)) ([15db92c](https://github.com/launchdarkly/js-core/commit/15db92c4bd9657747aa80cd4157cef69bae6aa73))

## [1.0.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.0.0...js-client-sdk-common-v1.0.0) (2024-03-05)


### Bug Fixes

* Bug in sdk-client where withReasons was not passed to streamer. ([#387](https://github.com/launchdarkly/js-core/issues/387)) ([15db92c](https://github.com/launchdarkly/js-core/commit/15db92c4bd9657747aa80cd4157cef69bae6aa73))

## [1.0.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.2.1...js-client-sdk-common-v1.0.0) (2024-02-08)


### Features

* React Native SDK major release. ([#369](https://github.com/launchdarkly/js-core/issues/369)) ([1d5ca40](https://github.com/launchdarkly/js-core/commit/1d5ca40888c4db4bb938884ca55732750fb10614))

## [0.2.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.2.0...js-client-sdk-common-v0.2.1) (2024-02-07)


### Bug Fixes

* Minor fixes from docs pr review. ([#363](https://github.com/launchdarkly/js-core/issues/363)) ([4768bf7](https://github.com/launchdarkly/js-core/commit/4768bf72a6c7c6f48fb2742fbb75f4c0851275f0))

## [0.2.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.1.2...js-client-sdk-common-v0.2.0) (2024-02-06)


### Features

* Implement common client side support for auto environment attributes. ([#356](https://github.com/launchdarkly/js-core/issues/356)) ([8d80259](https://github.com/launchdarkly/js-core/commit/8d80259f7379827e46bef8bcf8293e3b2d966d25))
* React-native support for auto-env attributes. Only affects react-native package. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))
* Update eslint jest configuration and versions. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))


### Bug Fixes

* Add LDOptions.application name and versionName. ([#358](https://github.com/launchdarkly/js-core/issues/358)) ([cd75210](https://github.com/launchdarkly/js-core/commit/cd75210d20e3d989897ea42276792d934ac8c9c1))
* Add RN SDK offline support through ConnectionMode. ([#361](https://github.com/launchdarkly/js-core/issues/361)) ([d97ce82](https://github.com/launchdarkly/js-core/commit/d97ce82861438a1b79b93799a9d061cdfa1ab027))
* Implement anonymous context processing ([#350](https://github.com/launchdarkly/js-core/issues/350)) ([308100d](https://github.com/launchdarkly/js-core/commit/308100d095259635bfd8beca8a11aa8b43d7f29a))
* Improvements and fixes from docs review. ([#362](https://github.com/launchdarkly/js-core/issues/362)) ([ba07fbf](https://github.com/launchdarkly/js-core/commit/ba07fbf4ea0b505c4bdc6376b6b36d7a9c1e5fda))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.1.1 to 2.2.0

## [0.1.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.1.1...js-client-sdk-common-v0.1.2) (2024-01-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.1.0 to 2.1.1

## [0.1.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.1.0...js-client-sdk-common-v0.1.1) (2023-12-28)


### Bug Fixes

* Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))
* Remove release-as for sdk-client and rn sdk and updated READMEs. ([#337](https://github.com/launchdarkly/js-core/issues/337)) ([52bf088](https://github.com/launchdarkly/js-core/commit/52bf088bd9c7a75f673e37de829459bbad4deb90))

## [0.1.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v0.1.0...js-client-sdk-common-v0.1.0) (2023-12-28)


### Bug Fixes

* Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))

## 0.1.0 (2023-12-27)


### ⚠ BREAKING CHANGES

* Implement Migrations. Refactor for client SDKs. ([#293](https://github.com/launchdarkly/js-core/issues/293))

### Features

* Implement Migrations. Refactor for client SDKs. ([#293](https://github.com/launchdarkly/js-core/issues/293)) ([c66aa6e](https://github.com/launchdarkly/js-core/commit/c66aa6ea0d12e1e4e565cb8378d367c31fab9c1b))
