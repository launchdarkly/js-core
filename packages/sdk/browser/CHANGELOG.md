# Changelog

## [4.2.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v4.2.0...js-client-sdk-v4.2.1) (2026-02-25)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.19.0 to 1.19.1

## [4.2.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v4.1.1...js-client-sdk-v4.2.0) (2026-02-24)


### Features

* move bootstrap capability to js-client-common (SDK-1874) ([#1113](https://github.com/launchdarkly/js-core/issues/1113)) ([baa8ab4](https://github.com/launchdarkly/js-core/commit/baa8ab43898be51a498c2a8238e466f5194c2698))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.18.1 to 1.19.0

## [4.1.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v4.1.0...js-client-sdk-v4.1.1) (2026-02-23)


### Bug Fixes

* Automatically stream when individual flag event listeners are re… ([#1114](https://github.com/launchdarkly/js-core/issues/1114)) ([c15b7a8](https://github.com/launchdarkly/js-core/commit/c15b7a8aba3712f3b077722d0df11443b58d4e0c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.18.0 to 1.18.1

## [4.1.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v4.0.0...js-client-sdk-v4.1.0) (2026-02-19)


### Features

* **browser:** use shared readFlagsFromBootstrap from js-client-sdk-common ([#1107](https://github.com/launchdarkly/js-core/issues/1107)) ([68fe311](https://github.com/launchdarkly/js-core/commit/68fe311c5c655a831df69abbd8f0eb543cf9333d))

## [4.0.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v4.0.0...js-client-sdk-v4.0.0) (2026-02-19)


### Features

* **browser:** use shared readFlagsFromBootstrap from js-client-sdk-common ([#1107](https://github.com/launchdarkly/js-core/issues/1107)) ([68fe311](https://github.com/launchdarkly/js-core/commit/68fe311c5c655a831df69abbd8f0eb543cf9333d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.17.2 to 1.18.0

## [4.0.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.13.1...js-client-sdk-v4.0.0) (2026-02-04)


### ⚠ BREAKING CHANGES

* release js-client-sdk v4 ([#1093](https://github.com/launchdarkly/js-core/issues/1093))

### Features

* release js-client-sdk v4 ([#1093](https://github.com/launchdarkly/js-core/issues/1093)) ([1457793](https://github.com/launchdarkly/js-core/commit/1457793489aeb94113e796b47a80c222975096c3))

## [0.13.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.13.0...js-client-sdk-v0.13.1) (2026-02-03)


### Bug Fixes

* js-client-sdk bootstrap data parsed 2x ([#1077](https://github.com/launchdarkly/js-core/issues/1077)) ([2afaee0](https://github.com/launchdarkly/js-core/commit/2afaee09a5b248d15812ceadfb7d55a6e7732b92))

## [0.13.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.12.1...js-client-sdk-v0.13.0) (2026-01-21)


### ⚠ BREAKING CHANGES

* remove 3.x compatability layer ([#1063](https://github.com/launchdarkly/js-core/issues/1063))

### Features

* remove 3.x compatability layer ([#1063](https://github.com/launchdarkly/js-core/issues/1063)) ([a471805](https://github.com/launchdarkly/js-core/commit/a471805924784fd80ce7a60c7c4df1d967cfb117))


### Bug Fixes

* update LDClient to not require context key for client side identify methods ([#1045](https://github.com/launchdarkly/js-core/issues/1045)) ([0cf7660](https://github.com/launchdarkly/js-core/commit/0cf76600af7fb5b3ef42d4e2b4cb73a27443a5e3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.17.1 to 1.17.2

## [0.12.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.12.0...js-client-sdk-v0.12.1) (2026-01-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.17.0 to 1.17.1

## [0.12.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.11.0...js-client-sdk-v0.12.0) (2026-01-06)


### Features

* add legacy storage key cleanup functionality ([#1043](https://github.com/launchdarkly/js-core/issues/1043)) ([fe4725e](https://github.com/launchdarkly/js-core/commit/fe4725e24917fe795cee448383b4fe8fa8b4b56f))
* add waitForInitialization to RN SDK ([#1048](https://github.com/launchdarkly/js-core/issues/1048)) ([13ce456](https://github.com/launchdarkly/js-core/commit/13ce456d9e3a5bcf043734f757415d4856034257))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.16.0 to 1.17.0

## [0.11.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.10.0...js-client-sdk-v0.11.0) (2025-12-18)


### ⚠ BREAKING CHANGES

* align browser v4 intialization flow to specs ([#1040](https://github.com/launchdarkly/js-core/issues/1040))

### Features

* adding support for debug override plugins ([#1033](https://github.com/launchdarkly/js-core/issues/1033)) ([17f5e7d](https://github.com/launchdarkly/js-core/commit/17f5e7d7d11d502d54a6ccf88aea6bec3e4b775c))
* allow clients to evaluate bootstrapped flags when not ready ([#1036](https://github.com/launchdarkly/js-core/issues/1036)) ([9b4542a](https://github.com/launchdarkly/js-core/commit/9b4542a722e5d19e123e860faef113d134dad47c))
* implement `waitForInitialization` for browser sdk 4.x ([#1028](https://github.com/launchdarkly/js-core/issues/1028)) ([156532a](https://github.com/launchdarkly/js-core/commit/156532aea3ec39635dab21dbab125c81fc31a3f5))


### Code Refactoring

* align browser v4 intialization flow to specs ([#1040](https://github.com/launchdarkly/js-core/issues/1040)) ([eff6a55](https://github.com/launchdarkly/js-core/commit/eff6a55163508bee4f2dec574ad256f88ec513d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.15.2 to 1.16.0

## [0.10.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.9.1...js-client-sdk-v0.10.0) (2025-12-09)


### Features

* add initial polling retries to BrowserDataManager ([#1030](https://github.com/launchdarkly/js-core/issues/1030)) ([cd91013](https://github.com/launchdarkly/js-core/commit/cd910130cabb210b13f1dbb7e48cc179347bb05a))

## [0.9.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.9.0...js-client-sdk-v0.9.1) (2025-12-05)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.15.1 to 1.15.2

## [0.9.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.8.1...js-client-sdk-v0.9.0) (2025-11-21)


### ⚠ BREAKING CHANGES

* Only support identify with result. ([#1000](https://github.com/launchdarkly/js-core/issues/1000))

### Features

* Only support identify with result. ([#1000](https://github.com/launchdarkly/js-core/issues/1000)) ([7163adf](https://github.com/launchdarkly/js-core/commit/7163adf06b5084d47b61658e5b30fab002d7fc80))

## [0.8.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.8.0...js-client-sdk-v0.8.1) (2025-07-23)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.15.0 to 1.15.1

## [0.8.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.7.1...js-client-sdk-v0.8.0) (2025-06-17)


### Features

* Add support for an identify queue. ([#842](https://github.com/launchdarkly/js-core/issues/842)) ([78e9a5e](https://github.com/launchdarkly/js-core/commit/78e9a5e93cb4c06a19c0d7d63307dfd3407d4505))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.14.1 to 1.15.0

## [0.7.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.7.0...js-client-sdk-v0.7.1) (2025-06-03)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.14.0 to 1.14.1

## [0.7.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.6.0...js-client-sdk-v0.7.0) (2025-05-21)


### Features

* Add support for per-context summary events. ([#859](https://github.com/launchdarkly/js-core/issues/859)) ([c9fa5c4](https://github.com/launchdarkly/js-core/commit/c9fa5c45f3ac2cbaad2f2e6312d5231c3f671d98))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.13.0 to 1.14.0

## [0.6.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.5.3...js-client-sdk-v0.6.0) (2025-04-29)


### Features

* Add client-side SDK plugin support. ([#834](https://github.com/launchdarkly/js-core/issues/834)) ([a843a33](https://github.com/launchdarkly/js-core/commit/a843a33e97dcab706a0034bd1fd1e3d2f78a9262))


### Bug Fixes

* Client SDKs should use wrapper information. ([#836](https://github.com/launchdarkly/js-core/issues/836)) ([1e0cf6a](https://github.com/launchdarkly/js-core/commit/1e0cf6a0f77f8cfe6a7a0e675fc6490ea52a5b07))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.6 to 1.13.0

## [0.5.3](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.5.2...js-client-sdk-v0.5.3) (2025-04-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.5 to 1.12.6

## [0.5.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.5.1...js-client-sdk-v0.5.2) (2025-04-15)


### Bug Fixes

* Handle default flush interval for browser SDK. ([#822](https://github.com/launchdarkly/js-core/issues/822)) ([2c1cc7a](https://github.com/launchdarkly/js-core/commit/2c1cc7a117fd011a329dfcc5332fddf7fd11eff9))

## [0.5.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.5.0...js-client-sdk-v0.5.1) (2025-04-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.4 to 1.12.5

## [0.5.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.4.1...js-client-sdk-v0.5.0) (2025-03-26)


### Features

* Support inline context for custom and migration events ([6aadf04](https://github.com/launchdarkly/js-core/commit/6aadf0463968f89bc3df10023267244c2ade1b31))


### Bug Fixes

* Deprecate LDMigrationOpEvent.contextKeys in favor of LDMigrationOpEvent.context ([6aadf04](https://github.com/launchdarkly/js-core/commit/6aadf0463968f89bc3df10023267244c2ade1b31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.3 to 1.12.4

## [0.4.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.4.0...js-client-sdk-v0.4.1) (2025-02-06)


### Bug Fixes

* Ensure streaming connection is closed on SDK close. ([#774](https://github.com/launchdarkly/js-core/issues/774)) ([f58e746](https://github.com/launchdarkly/js-core/commit/f58e746a089fb0cd5f6169f6c246e1f6515f5047))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.2 to 1.12.3

## [0.4.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.3.3...js-client-sdk-v0.4.0) (2025-01-22)


### Features

* Enable source maps with inlined sources for browser SDK. ([#734](https://github.com/launchdarkly/js-core/issues/734)) ([c2a87b1](https://github.com/launchdarkly/js-core/commit/c2a87b11d1eeb31bf0423e3d7dfc8e99fc940c99))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.1 to 1.12.2

## [0.3.3](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.3.2...js-client-sdk-v0.3.3) (2024-11-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.12.0 to 1.12.1

## [0.3.2](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.3.1...js-client-sdk-v0.3.2) (2024-11-13)


### Bug Fixes

* Export correct options for compat. ([#678](https://github.com/launchdarkly/js-core/issues/678)) ([8d8250c](https://github.com/launchdarkly/js-core/commit/8d8250cafb20b60e45ac3661fd8b079cb62fb83e))

## [0.3.1](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.3.0...js-client-sdk-v0.3.1) (2024-11-08)


### Bug Fixes

* Consolidate common exports between base package and compat package. ([#674](https://github.com/launchdarkly/js-core/issues/674)) ([f692050](https://github.com/launchdarkly/js-core/commit/f69205082d83318e2772d027d6ea533de3ce5eb1))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.2.0...js-client-sdk-v0.3.0) (2024-11-04)


### Features

* Enhance basic logger destination support. ([#650](https://github.com/launchdarkly/js-core/issues/650)) ([21670c4](https://github.com/launchdarkly/js-core/commit/21670c4acd629f7ccfeb7abbe94fe89723533600))


### Bug Fixes

* Export LDInspection interface. ([#653](https://github.com/launchdarkly/js-core/issues/653)) ([7f58b2a](https://github.com/launchdarkly/js-core/commit/7f58b2aa947f85c5b3c2462882ccb52a9dbb8ce5))
* Export required types from compat. ([#645](https://github.com/launchdarkly/js-core/issues/645)) ([008dcf0](https://github.com/launchdarkly/js-core/commit/008dcf0e7693b47d2079badad5ba038c0f9e82fe))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.11.0 to 1.12.0

## [0.2.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.1.0...js-client-sdk-v0.2.0) (2024-10-29)


### Features

* Add a module for increased backward compatibility. ([#637](https://github.com/launchdarkly/js-core/issues/637)) ([44a2237](https://github.com/launchdarkly/js-core/commit/44a223730fed10fbd75e8de7c87c63570774fe96))
* Refine CJS/ESM build configuration for browser SDK. ([#640](https://github.com/launchdarkly/js-core/issues/640)) ([ec4377c](https://github.com/launchdarkly/js-core/commit/ec4377cc2afc62455aba769c20f3831cccd50250))
* Vendor escapeStringRegexp to simplify builds. ([48cac54](https://github.com/launchdarkly/js-core/commit/48cac546f6d36a6b70f3b1f7cb72d1dcff2b50ba))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.10.0 to 1.11.0

## [0.1.0](https://github.com/launchdarkly/js-core/compare/js-client-sdk-v0.0.1...js-client-sdk-v0.1.0) (2024-10-17)


### Features

* Add prerequisite information to server-side allFlagsState. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* Add support for client-side prerequisite events. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* Add support for inspectors. ([#625](https://github.com/launchdarkly/js-core/issues/625)) ([a986478](https://github.com/launchdarkly/js-core/commit/a986478ed8e39d0f529ca6adec0a09b484421390))
* Add support for prerequisite details to evaluation detail. ([8c84e01](https://github.com/launchdarkly/js-core/commit/8c84e0149a5621c6fcb95f2cfdbd6112f3540191))
* adds ping stream support ([#624](https://github.com/launchdarkly/js-core/issues/624)) ([dee53af](https://github.com/launchdarkly/js-core/commit/dee53af9312b74a70b748d49b2d2911d65333cf3))
* Apply private property naming standard. Mangle browser private properties. ([#620](https://github.com/launchdarkly/js-core/issues/620)) ([3e6d404](https://github.com/launchdarkly/js-core/commit/3e6d404ae665c5cc7e5a1394a59c8f2c9d5d682a))


### Bug Fixes

* Do not mangle _meta. ([#622](https://github.com/launchdarkly/js-core/issues/622)) ([f6fc40b](https://github.com/launchdarkly/js-core/commit/f6fc40bc518d175d18d556b8c22e3c924ed25bbd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.9.0 to 1.10.0

## 0.0.1 (2024-10-10)


### Features

* Add basic secure mode support for browser SDK. ([#598](https://github.com/launchdarkly/js-core/issues/598)) ([3389983](https://github.com/launchdarkly/js-core/commit/33899830781affbe986f3bb9df35e5c908884f99))
* Add bootstrap support. ([#600](https://github.com/launchdarkly/js-core/issues/600)) ([4e5dbee](https://github.com/launchdarkly/js-core/commit/4e5dbee48d6bb236b5febd872c910e809058a012))
* Add browser info. ([#576](https://github.com/launchdarkly/js-core/issues/576)) ([a2f4398](https://github.com/launchdarkly/js-core/commit/a2f439813171527e05f5863afbda3fcb93fedb47))
* Add ESM support for common and common-client (rollup) ([#604](https://github.com/launchdarkly/js-core/issues/604)) ([8cd0cdc](https://github.com/launchdarkly/js-core/commit/8cd0cdce988f606b1efdf6bfd19484f6607db2e5))
* Add support for browser contract tests. ([#582](https://github.com/launchdarkly/js-core/issues/582)) ([38f081e](https://github.com/launchdarkly/js-core/commit/38f081ebf04c68123cf83addefbcbfec692cac16))
* Add support for hooks. ([#605](https://github.com/launchdarkly/js-core/issues/605)) ([04d347b](https://github.com/launchdarkly/js-core/commit/04d347b25e01015134a2545be22bfd8b1d1e85cc))
* Add support for js-client-sdk style initialization. ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))
* Add support for localStorage for the browser platform. ([#566](https://github.com/launchdarkly/js-core/issues/566)) ([4792391](https://github.com/launchdarkly/js-core/commit/4792391d1ae06f5d5afc7f7ab56608df6b1909c4))
* Add URLs for custom events and URL filtering. ([#587](https://github.com/launchdarkly/js-core/issues/587)) ([7131e69](https://github.com/launchdarkly/js-core/commit/7131e6905f19cc10a1374aae5e74cec66c7fd6de))
* Add visibility handling to allow proactive event flushing. ([#607](https://github.com/launchdarkly/js-core/issues/607)) ([819a311](https://github.com/launchdarkly/js-core/commit/819a311db6f56e323bb84c925789ad4bd19ae4ba))
* adds datasource status to sdk-client ([#590](https://github.com/launchdarkly/js-core/issues/590)) ([6f26204](https://github.com/launchdarkly/js-core/commit/6f262045b76836e5d2f5ccc2be433094993fcdbb))
* Adds support for REPORT. ([#575](https://github.com/launchdarkly/js-core/issues/575)) ([916b724](https://github.com/launchdarkly/js-core/commit/916b72409b63abdf350e70cca41331c4204b6e95))
* Browser-SDK Automatically start streaming based on event handlers. ([#592](https://github.com/launchdarkly/js-core/issues/592)) ([f2e5cbf](https://github.com/launchdarkly/js-core/commit/f2e5cbf1d0b3ae39a95881fecdcbefc11e9d0363))
* Implement browser crypto and encoding. ([#574](https://github.com/launchdarkly/js-core/issues/574)) ([e763e5d](https://github.com/launchdarkly/js-core/commit/e763e5d2e53329c0f86b93544af85ca7a94e7936))
* Implement goals for client-side SDKs. ([#585](https://github.com/launchdarkly/js-core/issues/585)) ([fd38a8f](https://github.com/launchdarkly/js-core/commit/fd38a8fa8560dad0c6721c2eaeed2f3f5c674900))
* Implement support for browser requests. ([#578](https://github.com/launchdarkly/js-core/issues/578)) ([887548a](https://github.com/launchdarkly/js-core/commit/887548a29e22a618d44a6941c175f33402e331bf))
* Refactor data source connection handling.  ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))
* Scaffold browser client. ([#579](https://github.com/launchdarkly/js-core/issues/579)) ([0848ab7](https://github.com/launchdarkly/js-core/commit/0848ab790903f8fcdc717de6c426e4948abe51c4))


### Bug Fixes

* Ensure browser contract tests run during top-level build. ([#589](https://github.com/launchdarkly/js-core/issues/589)) ([7dfb14d](https://github.com/launchdarkly/js-core/commit/7dfb14de1757b66d9f876b25d4c1262e8f8b70c9))
* Ensure client logger is always wrapped in a safe logger. ([#599](https://github.com/launchdarkly/js-core/issues/599)) ([980e4da](https://github.com/launchdarkly/js-core/commit/980e4daaf32864e18f14b1e5e28e308dff0ae94f))
