# Changelog

## [1.12.3](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.12.2...js-client-sdk-common-v1.12.3) (2025-02-06)


### Bug Fixes

* Ensure streaming connection is closed on SDK close. ([#774](https://github.com/launchdarkly/js-core/issues/774)) ([f58e746](https://github.com/launchdarkly/js-core/commit/f58e746a089fb0cd5f6169f6c246e1f6515f5047))

## [1.12.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.12.1...js-client-sdk-common-v1.12.2) (2025-01-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.12.0 to 2.13.0

## [1.12.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.12.0...js-client-sdk-common-v1.12.1) (2024-11-22)


### Bug Fixes

* Ensure flag-detail-changed is called for deleted flags. ([#695](https://github.com/launchdarkly/js-core/issues/695)) ([6524030](https://github.com/launchdarkly/js-core/commit/6524030b41263a584b22211fcbbad10919582f1b))

## [1.12.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.11.0...js-client-sdk-common-v1.12.0) (2024-11-04)


### Features

* Enhance basic logger destination support. ([#650](https://github.com/launchdarkly/js-core/issues/650)) ([21670c4](https://github.com/launchdarkly/js-core/commit/21670c4acd629f7ccfeb7abbe94fe89723533600))


### Bug Fixes

* Export LDInspection interface. ([#653](https://github.com/launchdarkly/js-core/issues/653)) ([7f58b2a](https://github.com/launchdarkly/js-core/commit/7f58b2aa947f85c5b3c2462882ccb52a9dbb8ce5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.11.0 to 2.12.0

## [1.11.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.10.0...js-client-sdk-common-v1.11.0) (2024-10-29)


### Features

* Add a module for increased backward compatibility. ([#637](https://github.com/launchdarkly/js-core/issues/637)) ([44a2237](https://github.com/launchdarkly/js-core/commit/44a223730fed10fbd75e8de7c87c63570774fe96))

## [1.10.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.9.0...js-client-sdk-common-v1.10.0) (2024-10-17)


### Features

* Add prerequisite information to server-side allFlagsState. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* Add support for client-side prerequisite events. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* Add support for inspectors. ([#625](https://github.com/launchdarkly/js-core/issues/625)) ([a986478](https://github.com/launchdarkly/js-core/commit/a986478ed8e39d0f529ca6adec0a09b484421390))
* Add support for prerequisite details to evaluation detail. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* adds ping stream support ([#624](https://github.com/launchdarkly/js-core/issues/624)) ([dee53af](https://github.com/launchdarkly/js-core/commit/dee53af9312b74a70b748d49b2d2911d65333cf3))
* Apply private property naming standard. Mangle browser private properties. ([#620](https://github.com/launchdarkly/js-core/issues/620)) ([3e6d404](https://github.com/launchdarkly/js-core/commit/3e6d404ae665c5cc7e5a1394a59c8f2c9d5d682a))


### Bug Fixes

* Prerequisites should not trigger hooks. ([#628](https://github.com/launchdarkly/js-core/issues/628)) ([70cf3c3](https://github.com/launchdarkly/js-core/commit/70cf3c3cdc507b6df3597ea4954645bb2cc760df))
* Update sdk-client rollup configuration to match common ([#630](https://github.com/launchdarkly/js-core/issues/630)) ([e061811](https://github.com/launchdarkly/js-core/commit/e06181158d29824ff0131a88988c84cd4a32f6c0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.10.0 to 2.11.0

## [1.9.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.8.0...js-client-sdk-common-v1.9.0) (2024-10-09)


### Features

* Add basic secure mode support for browser SDK. ([#598](https://github.com/launchdarkly/js-core/issues/598)) ([3389983](https://github.com/launchdarkly/js-core/commit/33899830781affbe986f3bb9df35e5c908884f99))
* Add bootstrap support. ([#600](https://github.com/launchdarkly/js-core/issues/600)) ([4e5dbee](https://github.com/launchdarkly/js-core/commit/4e5dbee48d6bb236b5febd872c910e809058a012))
* Add ESM support for common and common-client (rollup) ([#604](https://github.com/launchdarkly/js-core/issues/604)) ([8cd0cdc](https://github.com/launchdarkly/js-core/commit/8cd0cdce988f606b1efdf6bfd19484f6607db2e5))
* Add support for hooks. ([#605](https://github.com/launchdarkly/js-core/issues/605)) ([04d347b](https://github.com/launchdarkly/js-core/commit/04d347b25e01015134a2545be22bfd8b1d1e85cc))
* Add visibility handling to allow proactive event flushing. ([#607](https://github.com/launchdarkly/js-core/issues/607)) ([819a311](https://github.com/launchdarkly/js-core/commit/819a311db6f56e323bb84c925789ad4bd19ae4ba))
* adds datasource status to sdk-client ([#590](https://github.com/launchdarkly/js-core/issues/590)) ([6f26204](https://github.com/launchdarkly/js-core/commit/6f262045b76836e5d2f5ccc2be433094993fcdbb))
* adds support for individual flag change listeners ([#608](https://github.com/launchdarkly/js-core/issues/608)) ([da31436](https://github.com/launchdarkly/js-core/commit/da3143654331d7d2fd8ba76d9d995855dbf6c7a1))
* Browser-SDK Automatically start streaming based on event handlers. ([#592](https://github.com/launchdarkly/js-core/issues/592)) ([f2e5cbf](https://github.com/launchdarkly/js-core/commit/f2e5cbf1d0b3ae39a95881fecdcbefc11e9d0363))


### Bug Fixes

* Ensure client logger is always wrapped in a safe logger. ([#599](https://github.com/launchdarkly/js-core/issues/599)) ([980e4da](https://github.com/launchdarkly/js-core/commit/980e4daaf32864e18f14b1e5e28e308dff0ae94f))
* Use flagVersion in analytics events. ([#611](https://github.com/launchdarkly/js-core/issues/611)) ([35fa033](https://github.com/launchdarkly/js-core/commit/35fa0332dc1553c82afd75c9a4770a4833f2dca3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.9.0 to 2.10.0

## [1.8.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.7.0...js-client-sdk-common-v1.8.0) (2024-09-26)


### Features

* Add platform support for async hashing. ([#573](https://github.com/launchdarkly/js-core/issues/573)) ([9248035](https://github.com/launchdarkly/js-core/commit/9248035a88fba1c7375c5df22ef6b4a80a867983))
* Add support for conditional event source capabilities. ([#577](https://github.com/launchdarkly/js-core/issues/577)) ([fe82500](https://github.com/launchdarkly/js-core/commit/fe82500f28cf8d8311502098aa6cc2e73932064e))
* Add support for js-client-sdk style initialization. ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))
* Add URLs for custom events and URL filtering. ([#587](https://github.com/launchdarkly/js-core/issues/587)) ([7131e69](https://github.com/launchdarkly/js-core/commit/7131e6905f19cc10a1374aae5e74cec66c7fd6de))
* Adds support for REPORT. ([#575](https://github.com/launchdarkly/js-core/issues/575)) ([916b724](https://github.com/launchdarkly/js-core/commit/916b72409b63abdf350e70cca41331c4204b6e95))
* Allow using custom user-agent name. ([#580](https://github.com/launchdarkly/js-core/issues/580)) ([ed5a206](https://github.com/launchdarkly/js-core/commit/ed5a206c86f496942664dd73f6f8a7c602a1de28))
* Implement goals for client-side SDKs. ([#585](https://github.com/launchdarkly/js-core/issues/585)) ([fd38a8f](https://github.com/launchdarkly/js-core/commit/fd38a8fa8560dad0c6721c2eaeed2f3f5c674900))
* Refactor data source connection handling.  ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))


### Bug Fixes

* Flag store should not access values from prototype. ([#567](https://github.com/launchdarkly/js-core/issues/567)) ([fca4d92](https://github.com/launchdarkly/js-core/commit/fca4d9293746d023a0a122110849bbf335aa3b62))
* Use flag value whenever provided even if variaiton is null or undefined. ([#581](https://github.com/launchdarkly/js-core/issues/581)) ([d11224c](https://github.com/launchdarkly/js-core/commit/d11224c64863c007f4f42f4c48683fd170dd2b32))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.8.0 to 2.9.0

## [1.7.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-common-v1.6.0...js-client-sdk-common-v1.7.0) (2024-09-03)


### Features

* Add support for Payload Filtering ([#551](https://github.com/launchdarkly/js-core/issues/551)) ([6f44383](https://github.com/launchdarkly/js-core/commit/6f4438323baed802d8f951ac82494e6cfa9932c5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-sdk-common bumped from 2.7.0 to 2.8.0

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
