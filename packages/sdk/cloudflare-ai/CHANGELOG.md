# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial MVP release
- AI Config support for Cloudflare Workers AI
- Model name aliasing and resolution
- Template-based prompt interpolation with Mustache
- Comprehensive metrics tracking
- TypeScript type definitions
- Support for 15+ common AI models
- CloudflareAIModelMapper for model ID resolution
- LDAIClient with config method
- LDAIConfigTracker for analytics
- Basic test coverage
- Documentation and examples

## [0.1.0] - 2025-10-07

### Added
- Initial alpha release of `@launchdarkly/cloudflare-server-sdk-ai`
- `initAi(ldClient, clientSideID?, kvNamespace?)` initializer
- `aiClient.config(key, context, defaultValue, variables?)`
- `config.toCloudflareWorkersAI(options?)` for mapping to Workers AI format
- `config.runWithWorkersAI(env.AI, options?)` convenience with auto-metrics
- Template interpolation for messages using variables
- Metrics tracking: success, duration, token usage, optional error tracking
- Example Cloudflare Worker and setup docs

### Notes
- Requires LaunchDarkly Cloudflare KV integration to be enabled
- Tested with Workers AI [ai] binding and `nodejs_compat` flag

