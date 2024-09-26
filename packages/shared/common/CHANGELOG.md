# Changelog

All notable changes to `@launchdarkly/js-sdk-common` will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [2.9.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.8.0...js-sdk-common-v2.9.0) (2024-09-26)


### Features

* Add platform support for async hashing. ([#573](https://github.com/launchdarkly/js-core/issues/573)) ([9248035](https://github.com/launchdarkly/js-core/commit/9248035a88fba1c7375c5df22ef6b4a80a867983))
* Add support for conditional event source capabilities. ([#577](https://github.com/launchdarkly/js-core/issues/577)) ([fe82500](https://github.com/launchdarkly/js-core/commit/fe82500f28cf8d8311502098aa6cc2e73932064e))
* Add URLs for custom events and URL filtering. ([#587](https://github.com/launchdarkly/js-core/issues/587)) ([7131e69](https://github.com/launchdarkly/js-core/commit/7131e6905f19cc10a1374aae5e74cec66c7fd6de))
* Adds support for REPORT. ([#575](https://github.com/launchdarkly/js-core/issues/575)) ([916b724](https://github.com/launchdarkly/js-core/commit/916b72409b63abdf350e70cca41331c4204b6e95))
* Allow using custom user-agent name. ([#580](https://github.com/launchdarkly/js-core/issues/580)) ([ed5a206](https://github.com/launchdarkly/js-core/commit/ed5a206c86f496942664dd73f6f8a7c602a1de28))
* Implement goals for client-side SDKs. ([#585](https://github.com/launchdarkly/js-core/issues/585)) ([fd38a8f](https://github.com/launchdarkly/js-core/commit/fd38a8fa8560dad0c6721c2eaeed2f3f5c674900))


### Bug Fixes

* Multi-kind context containing only 1 kind conveted incorrectly. ([#594](https://github.com/launchdarkly/js-core/issues/594)) ([b6ff2a6](https://github.com/launchdarkly/js-core/commit/b6ff2a67db9f9a24da4a45ad88fa7f2a22fb635d))

## [2.8.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.7.0...js-sdk-common-v2.8.0) (2024-09-03)


### Features

* Add support for Payload Filtering ([#551](https://github.com/launchdarkly/js-core/issues/551)) ([6f44383](https://github.com/launchdarkly/js-core/commit/6f4438323baed802d8f951ac82494e6cfa9932c5))

## [2.7.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.6.0...js-sdk-common-v2.7.0) (2024-08-28)


### Features

* Correct client evaluation typings. ([#554](https://github.com/launchdarkly/js-core/issues/554)) ([64ab88d](https://github.com/launchdarkly/js-core/commit/64ab88d278308564b4cd7b6433870c7adb09142a))

## [2.6.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.5.0...js-sdk-common-v2.6.0) (2024-08-12)


### Features

* refactors the implementation of context caching.  You can now s… ([#531](https://github.com/launchdarkly/js-core/issues/531)) ([8ab2ee4](https://github.com/launchdarkly/js-core/commit/8ab2ee425a35350a4f1c50e608c39fa3527da513))

## [2.5.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.4.2...js-sdk-common-v2.5.0) (2024-06-04)


### Features

* Add support for a cancel-able timeout. ([#476](https://github.com/launchdarkly/js-core/issues/476)) ([24ecf1d](https://github.com/launchdarkly/js-core/commit/24ecf1d74b01e1fb32cd250689f17f96d1af1f50))

## [2.4.2](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.4.1...js-sdk-common-v2.4.2) (2024-04-26)


### Bug Fixes

* Handle missing message with valid string. ([#450](https://github.com/launchdarkly/js-core/issues/450)) ([6ff8982](https://github.com/launchdarkly/js-core/commit/6ff8982d5a68f1fff4b8fcafc3eb015a75d3f002))
* Produce a warning when track is called with a non-numeric metric value. ([#449](https://github.com/launchdarkly/js-core/issues/449)) ([6799742](https://github.com/launchdarkly/js-core/commit/6799742a7914d32b3313e54408f0a2a3dda3ff5c))

## [2.4.1](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.4.0...js-sdk-common-v2.4.1) (2024-04-09)


### Bug Fixes

* Add TimeoutError. ([#428](https://github.com/launchdarkly/js-core/issues/428)) ([aa832db](https://github.com/launchdarkly/js-core/commit/aa832db6172ba727aad9ec478b09a45906e9d5a7))

## [2.4.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.3.1...js-sdk-common-v2.4.0) (2024-04-09)


### Features

* Add identify timeout to client-sdk. ([#420](https://github.com/launchdarkly/js-core/issues/420)) ([5d73dfe](https://github.com/launchdarkly/js-core/commit/5d73dfeb0d5cdacf620e65e214dd2e334363490e))


### Bug Fixes

* Identify incorrectly rejected in client-sdk ([#426](https://github.com/launchdarkly/js-core/issues/426)) ([a019dd6](https://github.com/launchdarkly/js-core/commit/a019dd66b1b852d888e10b78aec9693d7de195fe))

## [2.3.1](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.3.0...js-sdk-common-v2.3.1) (2024-03-25)


### Bug Fixes

* Send identify event. ([#407](https://github.com/launchdarkly/js-core/issues/407)) ([1d73462](https://github.com/launchdarkly/js-core/commit/1d73462914cd35925d34a84b61492a52406b4083))

## [2.3.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.2.0...js-sdk-common-v2.3.0) (2024-03-15)


### Features

* Always inline contexts for feature events ([#351](https://github.com/launchdarkly/js-core/issues/351)) ([961d21b](https://github.com/launchdarkly/js-core/commit/961d21bf1fef79f30c267cf30d0bccb4ad3feff6))
* Redact anonymous attributes within feature events ([#352](https://github.com/launchdarkly/js-core/issues/352)) ([8f7ad7e](https://github.com/launchdarkly/js-core/commit/8f7ad7e7ab0032491d11565a0943a5560c98052f))

## [2.2.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.1.1...js-sdk-common-v2.2.0) (2024-02-06)


### Features

* Implement common client side support for auto environment attributes. ([#356](https://github.com/launchdarkly/js-core/issues/356)) ([8d80259](https://github.com/launchdarkly/js-core/commit/8d80259f7379827e46bef8bcf8293e3b2d966d25))
* Implement common support for auto environment attributes. ([#355](https://github.com/launchdarkly/js-core/issues/355)) ([9f562e5](https://github.com/launchdarkly/js-core/commit/9f562e51c60ac5bfff835e7f6724904939710148))
* React-native support for auto-env attributes. Only affects react-native package. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))
* Update eslint jest configuration and versions. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))


### Bug Fixes

* Add LDOptions.application name and versionName. ([#358](https://github.com/launchdarkly/js-core/issues/358)) ([cd75210](https://github.com/launchdarkly/js-core/commit/cd75210d20e3d989897ea42276792d934ac8c9c1))
* Add RN SDK offline support through ConnectionMode. ([#361](https://github.com/launchdarkly/js-core/issues/361)) ([d97ce82](https://github.com/launchdarkly/js-core/commit/d97ce82861438a1b79b93799a9d061cdfa1ab027))
* Implement anonymous context processing ([#350](https://github.com/launchdarkly/js-core/issues/350)) ([308100d](https://github.com/launchdarkly/js-core/commit/308100d095259635bfd8beca8a11aa8b43d7f29a))
* RN streamer connection in background and foreground. ([#360](https://github.com/launchdarkly/js-core/issues/360)) ([c69b768](https://github.com/launchdarkly/js-core/commit/c69b7686eed1971288adfbe527b4bf53ba5fe2b7))

## [2.1.1](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.1.0...js-sdk-common-v2.1.1) (2024-01-16)


### Bug Fixes

* remove type modifiers on imports for better TS compatibility ([#346](https://github.com/launchdarkly/js-core/issues/346)) ([3506349](https://github.com/launchdarkly/js-core/commit/3506349512f2288ba9bc2b2bd79d6ed38fd3684c))
* Treat 413 HTTP status as recoverable for events. ([#348](https://github.com/launchdarkly/js-core/issues/348)) ([4a6d4c3](https://github.com/launchdarkly/js-core/commit/4a6d4c3cae25e4993a798d0fd315b51ef607d727))

## [2.1.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v2.0.0...js-sdk-common-v2.1.0) (2023-11-14)


### Features

* edge sdks should send events to bulk/environment endpoint ([#256](https://github.com/launchdarkly/js-core/issues/256)) ([f45910f](https://github.com/launchdarkly/js-core/commit/f45910f171d434ca080bb6486331fbfbd2793985))

## [2.0.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v1.1.0...js-sdk-common-v2.0.0) (2023-10-16)


### ⚠ BREAKING CHANGES

* Implement Migrations. Refactor for client SDKs. ([#293](https://github.com/launchdarkly/js-core/issues/293))

### Features

* Implement Migrations. Refactor for client SDKs. ([#293](https://github.com/launchdarkly/js-core/issues/293)) ([c66aa6e](https://github.com/launchdarkly/js-core/commit/c66aa6ea0d12e1e4e565cb8378d367c31fab9c1b))

## [1.1.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v1.0.3...js-sdk-common-v1.1.0) (2023-08-14)


### Features

* Allow specifying the user agent per-sdk implementation. ([#226](https://github.com/launchdarkly/js-core/issues/226)) ([e57716f](https://github.com/launchdarkly/js-core/commit/e57716f3f6f0ba8568e32b0937903ca46e5470ad))

## [1.0.3](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v1.0.2...js-sdk-common-v1.0.3) (2023-08-10)


### Bug Fixes

* Switch to es2017 target to ensure native async/await. ([a83e4e6](https://github.com/launchdarkly/js-core/commit/a83e4e62d04c66105a1b0e8893640a7ca2d641e4))

## [1.0.2](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v1.0.1...js-sdk-common-v1.0.2) (2023-06-13)


### Bug Fixes

* Correctly handle excluded big segments. ([#160](https://github.com/launchdarkly/js-core/issues/160)) ([e9cb45a](https://github.com/launchdarkly/js-core/commit/e9cb45a14ed6d3f931680dab0feb4b5cef350592))

## [1.0.1](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v1.0.0...js-sdk-common-v1.0.1) (2023-04-27)


### Bug Fixes

* add licence and fix missing package.json fields. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))
* Ensure top level commands work correctly ([#105](https://github.com/launchdarkly/js-core/issues/105)) ([762571f](https://github.com/launchdarkly/js-core/commit/762571ff851558d229e4d29ba40a9c16b89f2a8d))
* remove beta text from cloudflare sdk readme. ([c586398](https://github.com/launchdarkly/js-core/commit/c5863980c5bf4ee2a7590dfc4f7c575045d669b0))

## [1.0.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v0.3.0...js-sdk-common-v1.0.0) (2023-04-26)


### Features

* initial major release ([#101](https://github.com/launchdarkly/js-core/issues/101)) ([9883675](https://github.com/launchdarkly/js-core/commit/98836758d1998f208a1e13a68955611e0b10a8ce))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v0.2.0...js-sdk-common-v0.3.0) (2023-04-19)


### Features

* create sdk-server-edge package ([#83](https://github.com/launchdarkly/js-core/issues/83)) ([0578190](https://github.com/launchdarkly/js-core/commit/0578190123e2712b50774ca3087c7577ef2b9eb2))

## [0.2.0](https://github.com/launchdarkly/js-core/compare/js-sdk-common-v0.1.0...js-sdk-common-v0.2.0) (2023-03-16)


### Features

* Update packaging to include only needed files. ([06b2f28](https://github.com/launchdarkly/js-core/commit/06b2f28c85ba9e8610f88cb234546403e534fa77))

## 0.1.0 (2023-03-15)

Initial prerelease version.
