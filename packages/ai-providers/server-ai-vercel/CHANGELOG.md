# Changelog

## [0.4.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.3.1...server-sdk-ai-vercel-v0.4.0) (2025-11-21)


### ⚠ BREAKING CHANGES

* Change to ES Modules to improve support of dynamic loading ([#1011](https://github.com/launchdarkly/js-core/issues/1011))

### Bug Fixes

* Change to ES Modules to improve support of dynamic loading ([#1011](https://github.com/launchdarkly/js-core/issues/1011)) ([11de076](https://github.com/launchdarkly/js-core/commit/11de076f270f730b0f05134ce9f57d573f7c0067))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.14.1 to ^0.15.0
  * peerDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.14.0 to ^0.15.0

## [0.3.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.3.0...server-sdk-ai-vercel-v0.3.1) (2025-11-13)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.14.0 to ^0.14.1
  * peerDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.14.0 to ^0.14.1

## [0.3.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.2.0...server-sdk-ai-vercel-v0.3.0) (2025-11-06)


### ⚠ BREAKING CHANGES

* Support invoke with structured output in VercelAI provider ([#981](https://github.com/launchdarkly/js-core/issues/981))

### Features

* Support invoke with structured output in VercelAI provider ([#981](https://github.com/launchdarkly/js-core/issues/981)) ([d0cb41d](https://github.com/launchdarkly/js-core/commit/d0cb41d3a06d6216daac76a516949f0243244417))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.13.0 to ^0.14.0
  * peerDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.12.2 to ^0.14.0

## [0.2.0](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.1.2...server-sdk-ai-vercel-v0.2.0) (2025-11-04)


### ⚠ BREAKING CHANGES

* VercelProvider now requires type safe parameters for Vercel models

### Features

* Add support for tracking streaming text metics with ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))
* Add toVercelAISDK method to support easy model creation ([#972](https://github.com/launchdarkly/js-core/issues/972)) ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))
* Renamed createAIMetrics to getAIMetricsFromResponse ([#977](https://github.com/launchdarkly/js-core/issues/977)) ([05b4667](https://github.com/launchdarkly/js-core/commit/05b4667fe6385672f89c84d49302ce40f99e28d5))


### Bug Fixes

* Check finishReason for an error when determining model success ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))
* Prefer totalUsage over usage when mapping to LDTokenUsage ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))
* Properly convert LD model parameters to Vercel model parameters ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))
* VercelProvider now requires type safe parameters for Vercel models ([28d3650](https://github.com/launchdarkly/js-core/commit/28d365026fc37d5b5056754d96a9c0615fff0870))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.12.3 to ^0.13.0

## [0.1.2](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.1.1...server-sdk-ai-vercel-v0.1.2) (2025-10-24)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.12.2 to ^0.12.3

## [0.1.1](https://github.com/launchdarkly/js-core/compare/server-sdk-ai-vercel-v0.1.0...server-sdk-ai-vercel-v0.1.1) (2025-10-16)


### Bug Fixes

* Fix metric tracking for v5 responses ([e6c42a8](https://github.com/launchdarkly/js-core/commit/e6c42a866ceb678b5be7da8e097bff71368d2e05))
* Reduce dependencies and use peer dependencies when needed ([#963](https://github.com/launchdarkly/js-core/issues/963)) ([7f3da30](https://github.com/launchdarkly/js-core/commit/7f3da3071ac175451a0c39bfb9717170e516997f))
* Support previous v4 of Vercel AI SDK ([#962](https://github.com/launchdarkly/js-core/issues/962)) ([e6c42a8](https://github.com/launchdarkly/js-core/commit/e6c42a866ceb678b5be7da8e097bff71368d2e05))

## 0.1.0 (2025-10-14)


### Features

* Add VercelAI Provider for AI SDK ([#948](https://github.com/launchdarkly/js-core/issues/948)) ([1db731b](https://github.com/launchdarkly/js-core/commit/1db731b98ca2b9d641ffe8cb30c3f50b3979b54c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/server-sdk-ai bumped from ^0.12.0 to ^0.12.1
