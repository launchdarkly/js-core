# Changelog

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
