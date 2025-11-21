# Changelog

## [0.14.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.14.0...server-sdk-ai-v0.14.1) (2025-11-13)


### Bug Fixes

* Include the AI Judge Config key with tracked metrics ([#986](https://github.com/launchdarkly/js-core/issues/986)) ([213fc79](https://github.com/launchdarkly/js-core/commit/213fc793c752af6517ba7c117219205fb62b9c65))

## [0.14.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.13.0...server-sdk-ai-v0.14.0) (2025-11-06)


### ⚠ BREAKING CHANGES

* Removed deprecated Vercel methods ([#983](https://github.com/launchdarkly/js-core/issues/983))
* Add support for real time judge evals ([#969](https://github.com/launchdarkly/js-core/issues/969))
* AI Config defaults require the "enabled" attribute
* Renamed LDAIAgentConfig to LDAIAgentConfigRequest for clarity
* Renamed LDAIAgent to LDAIAgentConfig *note the previous use of this name
* Renamed LDAIAgentDefault to LDAIAgentConfigDefault for clarity
* Renamed LDAIDefaults to LDAICompletionConfigDefault for clarity

### Features

* Add support for real time judge evals ([#969](https://github.com/launchdarkly/js-core/issues/969)) ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Added createJudge method ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Added judgeConfig method to AI SDK to retrieve an AI Judge Config ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Added trackEvalScores method to config tracker ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Chat will evaluate responses with configured judges ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Include AI SDK version in tracking information ([#985](https://github.com/launchdarkly/js-core/issues/985)) ([ef90564](https://github.com/launchdarkly/js-core/commit/ef90564ee1ed9411e77b836d2b5b8037ff671b07))
* Removed deprecated Vercel methods ([#983](https://github.com/launchdarkly/js-core/issues/983)) ([960a499](https://github.com/launchdarkly/js-core/commit/960a49927e795890e5093b0156ec6d721c3066fd))


### Bug Fixes

* AI Config defaults require the "enabled" attribute ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Renamed LDAIAgent to LDAIAgentConfig *note the previous use of this name ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Renamed LDAIAgentConfig to LDAIAgentConfigRequest for clarity ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Renamed LDAIAgentDefault to LDAIAgentConfigDefault for clarity ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))
* Renamed LDAIDefaults to LDAICompletionConfigDefault for clarity ([6ecd9ab](https://github.com/launchdarkly/js-core/commit/6ecd9ab4d97f6445adfd377709f14d7f3b420363))

## [0.13.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.12.3...server-sdk-ai-v0.13.0) (2025-11-04)


### Features

* Add support for trackStreamMetricsOf method ([#971](https://github.com/launchdarkly/js-core/issues/971)) ([e18979e](https://github.com/launchdarkly/js-core/commit/e18979e27f4542552762a30a390749541daa3749))


### Bug Fixes

* Deprecated toVercelAISDK, trackVercelAISDKStreamTextMetrics, use `@launchdarkly/server-sdk-ai-vercel` package ([e18979e](https://github.com/launchdarkly/js-core/commit/e18979e27f4542552762a30a390749541daa3749))

## [0.12.3](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.12.2...server-sdk-ai-v0.12.3) (2025-10-24)


### Bug Fixes

* Fix default configs always being disabled ([#965](https://github.com/launchdarkly/js-core/issues/965)) ([30e2305](https://github.com/launchdarkly/js-core/commit/30e23056e58a2ca5c5b33ad76db12731f19d01c3))

## [0.12.2](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.12.1...server-sdk-ai-v0.12.2) (2025-10-16)


### Bug Fixes

* Reduce dependencies and use peer dependencies when needed ([#963](https://github.com/launchdarkly/js-core/issues/963)) ([7f3da30](https://github.com/launchdarkly/js-core/commit/7f3da3071ac175451a0c39bfb9717170e516997f))

## [0.12.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.12.0...server-sdk-ai-v0.12.1) (2025-10-14)


### Bug Fixes

* Improve documentation for AI SDK and AIProvider ([#958](https://github.com/launchdarkly/js-core/issues/958)) ([17d595a](https://github.com/launchdarkly/js-core/commit/17d595aff301998030cfb62724b8eb37fea9adbf))

## [0.12.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.11.4...server-sdk-ai-v0.12.0) (2025-10-13)


### Features

* Add support for TrackedChats in the AI SDK ([#939](https://github.com/launchdarkly/js-core/issues/939)) ([a7ad0ea](https://github.com/launchdarkly/js-core/commit/a7ad0ead1408fdd80b333baa085c462f47ea5ac1))
* Add support for OpenAI AIProvider to the AI SDK ([#939](https://github.com/launchdarkly/js-core/issues/939)) ([a7ad0ea](https://github.com/launchdarkly/js-core/commit/a7ad0ead1408fdd80b333baa085c462f47ea5ac1))
* Add support for LangChain AIProvider to the AI SDK ([#939](https://github.com/launchdarkly/js-core/issues/939)) ([a7ad0ea](https://github.com/launchdarkly/js-core/commit/a7ad0ead1408fdd80b333baa085c462f47ea5ac1))
* Add support for Vercel AIProvider to the AI SDK ([#946](https://github.com/launchdarkly/js-core/issues/946)) ([8553f24](https://github.com/launchdarkly/js-core/commit/8553f2482a3437975b63992f622b4396cc4ac7e7))

## [0.11.4](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.11.3...server-sdk-ai-v0.11.4) (2025-09-15)


### Bug Fixes

* Support Vercel v5 AI SDK token usage ([#926](https://github.com/launchdarkly/js-core/issues/926)) ([0d059a4](https://github.com/launchdarkly/js-core/commit/0d059a43050eaaaba84262d5e16cf875ccb409ea))

## [0.11.3](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.11.2...server-sdk-ai-v0.11.3) (2025-08-29)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.16.1 to 2.16.2
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.16.2

## [0.11.2](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.11.1...server-sdk-ai-v0.11.2) (2025-08-26)


### Bug Fixes

* **ai-sdk:** Remove Vercel mapping method from LD ([#911](https://github.com/launchdarkly/js-core/issues/911)) ([f71a457](https://github.com/launchdarkly/js-core/commit/f71a45774eb3fc0fd0ac6a93b1443843d14712d2))

## [0.11.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.11.0...server-sdk-ai-v0.11.1) (2025-08-19)


### Bug Fixes

* Add usage tracking to config method ([#904](https://github.com/launchdarkly/js-core/issues/904)) ([7f0a54c](https://github.com/launchdarkly/js-core/commit/7f0a54c4d880c8bc784fee0d4a2bc9155e96c1b7))

## [0.11.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.10.1...server-sdk-ai-v0.11.0) (2025-08-01)


### Features

* Adding agent support for AI Configs ([#893](https://github.com/launchdarkly/js-core/issues/893)) ([bf95b92](https://github.com/launchdarkly/js-core/commit/bf95b92946e93b54e1eda7ffef96039b2b42b9aa))
* Update AI tracker to include model & provider name for metrics generation ([#901](https://github.com/launchdarkly/js-core/issues/901)) ([9474862](https://github.com/launchdarkly/js-core/commit/94748621034ed6b1a74060ee0c536bf96a3cd43d))


### Bug Fixes

* Remove deprecated track generation event ([#902](https://github.com/launchdarkly/js-core/issues/902)) ([40f8593](https://github.com/launchdarkly/js-core/commit/40f859386087a443948214e9b535527f125ffa39))

## [0.10.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.10.0...server-sdk-ai-v0.10.1) (2025-07-23)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.16.0 to 2.16.1
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.16.1

## [0.10.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.9...server-sdk-ai-v0.10.0) (2025-07-16)


### Features

* Adding Vercel AI SDK mapper ([#895](https://github.com/launchdarkly/js-core/issues/895)) ([0befee0](https://github.com/launchdarkly/js-core/commit/0befee0888d0af03b01c0cf6f46eacc80a3ce8e8))

## [0.9.9](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.8...server-sdk-ai-v0.9.9) (2025-06-17)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.15.2 to 2.16.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.16.0

## [0.9.8](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.7...server-sdk-ai-v0.9.8) (2025-05-21)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.15.1 to 2.15.2
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.15.2

## [0.9.7](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.6...server-sdk-ai-v0.9.7) (2025-04-29)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.15.0 to 2.15.1
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.15.1

## [0.9.6](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.5...server-sdk-ai-v0.9.6) (2025-04-16)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.14.0 to 2.15.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.15.0

## [0.9.5](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.4...server-sdk-ai-v0.9.5) (2025-04-08)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.13.0 to 2.14.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.14.0

## [0.9.4](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.3...server-sdk-ai-v0.9.4) (2025-03-26)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.12.1 to 2.13.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.13.0

## [0.9.3](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.2...server-sdk-ai-v0.9.3) (2025-03-21)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.12.0 to 2.12.1
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.12.1

## [0.9.2](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-v0.9.1...server-sdk-ai-v0.9.2) (2025-03-17)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.11.1 to 2.12.0
  * peerDependencies
    * @launchdarkly/js-server-sdk-common bumped from 2.x to 2.12.0

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
