# Changelog

## [0.1.0](https://github.com/launchdarkly/js-core/compare/browser-telemetry-v0.0.9...browser-telemetry-v0.1.0) (2025-01-22)


### ⚠ BREAKING CHANGES

* Updated AI config interface. ([#697](https://github.com/launchdarkly/js-core/issues/697))

### Features

* Add basic logging support for browser-telemetry. ([#736](https://github.com/launchdarkly/js-core/issues/736)) ([2ef1486](https://github.com/launchdarkly/js-core/commit/2ef14868ce581afbc5257448da13414a5ba1c100))
* Add browser telemetry options. ([#675](https://github.com/launchdarkly/js-core/issues/675)) ([c8352b2](https://github.com/launchdarkly/js-core/commit/c8352b21b678bb8f1063bb0c9df2e795c6cec8d5))
* Add browser-telemetry API types. ([#669](https://github.com/launchdarkly/js-core/issues/669)) ([89967ee](https://github.com/launchdarkly/js-core/commit/89967eec67da13951837f19b7671647fb96b2c8c))
* Add DOM collectors. ([#672](https://github.com/launchdarkly/js-core/issues/672)) ([4473a06](https://github.com/launchdarkly/js-core/commit/4473a06145b09205f1b03d31a2215b9c3b6d75c2))
* Add http collectors. ([#673](https://github.com/launchdarkly/js-core/issues/673)) ([6e60ddc](https://github.com/launchdarkly/js-core/commit/6e60ddc6932341ace2d16ace688d7774bc6340d4))
* Add singleton support for browser-telemetry. ([#739](https://github.com/launchdarkly/js-core/issues/739)) ([68a3b87](https://github.com/launchdarkly/js-core/commit/68a3b87fcc9600a7f64e7e2e1a15c12b9c370f25))
* Add stack trace parsing. ([#676](https://github.com/launchdarkly/js-core/issues/676)) ([ca1dd49](https://github.com/launchdarkly/js-core/commit/ca1dd49e596c73e807388cefcae36e956b3477a0))
* Add support for breadcrumb filtering. ([#733](https://github.com/launchdarkly/js-core/issues/733)) ([5c327a1](https://github.com/launchdarkly/js-core/commit/5c327a1c42625ec606a8599f59d58a1686f050e1))
* Add support for the session init event. ([320c07d](https://github.com/launchdarkly/js-core/commit/320c07d852a8902523c290a5249f92efffd89dde))
* Add the ability to filter errors. ([#743](https://github.com/launchdarkly/js-core/issues/743)) ([5cffb2b](https://github.com/launchdarkly/js-core/commit/5cffb2b5216f94941498ebb6bb783d0a8841d566))
* Export browser-telemetry initialization method. ([d1b364e](https://github.com/launchdarkly/js-core/commit/d1b364eaf08502b8b7d65c124833b617577fd081))
* Implement browser telemetry client. ([#691](https://github.com/launchdarkly/js-core/issues/691)) ([db74a99](https://github.com/launchdarkly/js-core/commit/db74a99c736c00521f317c1fcddb2d1038c01c1c))
* Make browser-telemetry specific inspector type. ([#741](https://github.com/launchdarkly/js-core/issues/741)) ([14ecdb3](https://github.com/launchdarkly/js-core/commit/14ecdb3570b04ee26c38f361bfa2db948c843fef))
* Random uuid for telemetry package. ([#689](https://github.com/launchdarkly/js-core/issues/689)) ([4cf34f9](https://github.com/launchdarkly/js-core/commit/4cf34f94f9d1a1949462187d09e7d84b096edb15))
* Rename initializeTelemetryInstance to initTelemetryInstance for consistency with initTelemetry. ([257734f](https://github.com/launchdarkly/js-core/commit/257734f74d5c36d9e68441d6ca7dd7d1a6a2ba9b))
* Source maps with inline sources for browser-telemetry. ([#735](https://github.com/launchdarkly/js-core/issues/735)) ([1656a85](https://github.com/launchdarkly/js-core/commit/1656a856e412a661af26ed08620aebedf2064ae1))
* Updated AI config interface. ([#697](https://github.com/launchdarkly/js-core/issues/697)) ([cd72ea8](https://github.com/launchdarkly/js-core/commit/cd72ea8193888b0635b5beffa0a877b18294777e))
* Vendor TraceKit ([d1b364e](https://github.com/launchdarkly/js-core/commit/d1b364eaf08502b8b7d65c124833b617577fd081))


### Bug Fixes

* Clear pending events buffer when registered. ([#727](https://github.com/launchdarkly/js-core/issues/727)) ([b6ad7df](https://github.com/launchdarkly/js-core/commit/b6ad7dfe1e16122ca16b6304e1a7b1c362cf2156))
* Export BrowserTelemetry, BrowserTelemetryInspector, and ImplementsCrumb. ([257734f](https://github.com/launchdarkly/js-core/commit/257734f74d5c36d9e68441d6ca7dd7d1a6a2ba9b))
* Fix breadcrumb filter option parsing. ([#742](https://github.com/launchdarkly/js-core/issues/742)) ([833f4ce](https://github.com/launchdarkly/js-core/commit/833f4ce18b53c31a042316768cfeb4118746857e))
* Remove BrowserTelemetry until more types are available. ([#671](https://github.com/launchdarkly/js-core/issues/671)) ([796b8a3](https://github.com/launchdarkly/js-core/commit/796b8a379e23b3345b1b5db3e324372570993603))
