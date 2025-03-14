# Changelog

## [0.9.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.0...server-sdk-ai-v0.9.1) (2025-02-18)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.11.0 to 2.11.1
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.11.1

## [0.9.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.8.2...server-sdk-ai-v0.9.0) (2025-02-06)


### Features

* add support for versioned metrics for AI Configs ([#773](https://github.com/launchdarkly/js-core/issues/773)) ([a3f756f](https://github.com/launchdarkly/js-core/commit/a3f756f3c3207a068115b147d5c7439e204b7ae4))

## [0.8.2](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.8.1...server-sdk-ai-v0.8.2) (2025-01-27)


### Bug Fixes

* **docs:** Node.js AI SDK: modelConfig --&gt; config in readme ([#765](https://github.com/launchdarkly/js-core/issues/765)) ([4d46117](https://github.com/launchdarkly/js-core/commit/4d4611700e7eebd9a7d6f8fd596a7a4ff3310802))

## [0.8.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.8.0...server-sdk-ai-v0.8.1) (2025-01-24)


### Bug Fixes

* Correct documentation for AI Config function. ([#754](https://github.com/launchdarkly/js-core/issues/754)) ([0bdb0be](https://github.com/launchdarkly/js-core/commit/0bdb0be6b0e0213c5139af9008884ea74be197b1))

## [0.8.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.7.1...server-sdk-ai-v0.8.0) (2025-01-23)


### Features

* track timeToFirstToken in LDAIConfigTracker ([#749](https://github.com/launchdarkly/js-core/issues/749)) ([c97674f](https://github.com/launchdarkly/js-core/commit/c97674fe521bcfe14dc6e0679bf25e293a2a1ad1))

## [0.7.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.7.0...server-sdk-ai-v0.7.1) (2025-01-22)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.10.0 to 2.11.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.11.0

## [0.7.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.6.0...server-sdk-ai-v0.7.0) (2024-12-17)


### Features

* Add support for tracking errors. ([#715](https://github.com/launchdarkly/js-core/issues/715)) ([02f1d3d](https://github.com/launchdarkly/js-core/commit/02f1d3daa711319a620a55b50481083980ab18f7))

## [0.6.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.5.0...server-sdk-ai-v0.6.0) (2024-12-10)


### ⚠ BREAKING CHANGES

* Change versionKey to variationKey. ([#709](https://github.com/launchdarkly/js-core/issues/709))

### Code Refactoring

* Change versionKey to variationKey. ([#709](https://github.com/launchdarkly/js-core/issues/709)) ([bfee298](https://github.com/launchdarkly/js-core/commit/bfee29843125c55be1b21e4f77c9d8c3c8698856))

## [0.5.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.4.0...server-sdk-ai-v0.5.0) (2024-12-09)


### ⚠ BREAKING CHANGES

* Rename model and providerid to name. ([#706](https://github.com/launchdarkly/js-core/issues/706))

### Features

* Add getSummary method to the tracker. ([#698](https://github.com/launchdarkly/js-core/issues/698)) ([4df902d](https://github.com/launchdarkly/js-core/commit/4df902d98584c88b072d6dab5f32a6ea8c4fcdf5))


### Code Refactoring

* Rename model and providerid to name. ([#706](https://github.com/launchdarkly/js-core/issues/706)) ([8dd3951](https://github.com/launchdarkly/js-core/commit/8dd39517cfc14c6e037a2438d22f20a9527c9ffa))

## [0.4.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.3.0...server-sdk-ai-v0.4.0) (2024-11-22)


### ⚠ BREAKING CHANGES

* Updated AI Config interface. ([#697](https://github.com/launchdarkly/js-core/issues/697))

### Features

* Updated AI Config interface. ([#697](https://github.com/launchdarkly/js-core/issues/697)) ([cd72ea8](https://github.com/launchdarkly/js-core/commit/cd72ea8193888b0635b5beffa0a877b18294777e))

## [0.3.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.2.1...server-sdk-ai-v0.3.0) (2024-11-15)


### Features

* Change the typing for the LDAIConfig. ([#688](https://github.com/launchdarkly/js-core/issues/688)) ([1f3f54a](https://github.com/launchdarkly/js-core/commit/1f3f54abef144cccc7ac5b9bfef8392b9d7f2618))

## [0.2.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.2.0...server-sdk-ai-v0.2.1) (2024-11-14)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.9.0 to 2.10.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.10.0

## [0.2.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.1.1...server-sdk-ai-v0.2.0) (2024-11-12)


### Features

* Include temperature and maxTokens in LDModelConfig. ([978dfa9](https://github.com/launchdarkly/js-core/commit/978dfa95d1c25f942d96b730b187f92af045f90f))


### Bug Fixes

* Update default typings to include enabled. ([978dfa9](https://github.com/launchdarkly/js-core/commit/978dfa95d1c25f942d96b730b187f92af045f90f))

## [0.1.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.1.0...server-sdk-ai-v0.1.1) (2024-11-08)


### Bug Fixes

* Do not include _ldMeta in returned config. ([#668](https://github.com/launchdarkly/js-core/issues/668)) ([89ce6db](https://github.com/launchdarkly/js-core/commit/89ce6dbbb2889af66ca53dd546c5977953dea972))
* Remove underscore token usage. Improve documentation. ([#667](https://github.com/launchdarkly/js-core/issues/667)) ([5fe36fb](https://github.com/launchdarkly/js-core/commit/5fe36fbd5b7047428204427fe6849d49de6ee952))

## 0.1.0 (2024-11-06)


### Features

* Add AI SDK for Server-Side JavaScript. ([#619](https://github.com/launchdarkly/js-core/issues/619)) ([18e8c4c](https://github.com/launchdarkly/js-core/commit/18e8c4c9c2189e7629e1e1eb995d85d857c4ae4f))
