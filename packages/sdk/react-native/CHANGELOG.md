# Changelog

### Dependencies



### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.0.2 to 1.0.3

## [10.0.5](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.4...react-native-client-sdk-v10.0.5) (2024-03-27)


### Bug Fixes

* Stream retry failure due to previous open connection. ([#409](https://github.com/launchdarkly/js-core/issues/409)) ([ae08e08](https://github.com/launchdarkly/js-core/commit/ae08e08470d954a683940c4263f3274ac73c4206))

## [10.0.3](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.2...react-native-client-sdk-v10.0.3) (2024-03-15)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.0.1 to 1.0.2

## [10.0.2](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.1...react-native-client-sdk-v10.0.2) (2024-03-05)


### Bug Fixes

* Guard against null auto env attributes and async-storage. ([#384](https://github.com/launchdarkly/js-core/issues/384)) ([14ce392](https://github.com/launchdarkly/js-core/commit/14ce392ade486fa8168d2dae8375e4c201912f83))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.0.0 to 1.0.1

## [10.0.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.2.1...react-native-client-sdk-v10.0.0) (2024-02-08)

### Introducing `@launchdarkly/react-native-client-sdk` as a replacement for `launchdarkly-react-native-client-sdk`.

* The SDK has been re-written in Typescript.
* Supports Expo.
* The SDK has been moved to a new [repository](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-native) in github.
* The SDK has a new [package name](https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk).


### Features

* React Native SDK major release. ([#369](https://github.com/launchdarkly/js-core/issues/369)) ([1d5ca40](https://github.com/launchdarkly/js-core/commit/1d5ca40888c4db4bb938884ca55732750fb10614))


### Bug Fixes

* Fix Detox e2e tests broken after 0.73 update. ([#366](https://github.com/launchdarkly/js-core/issues/366)) ([6349b98](https://github.com/launchdarkly/js-core/commit/6349b98e70554d8240f0e8d6b1090e4c37bde6eb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 0.2.1 to 1.0.0

## [0.2.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.2.0...react-native-client-sdk-v0.2.1) (2024-02-07)


### Bug Fixes

* Babel TypeError due to event-target-shim ([#365](https://github.com/launchdarkly/js-core/issues/365)) ([c1c0086](https://github.com/launchdarkly/js-core/commit/c1c008610f36c8dd0c1e3da3cf9450c64d41874f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 0.2.0 to 0.2.1

## [0.2.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.5...react-native-client-sdk-v0.2.0) (2024-02-06)


### Features

* React-native support for auto-env attributes. Only affects react-native package. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))
* Update eslint jest configuration and versions. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))


### Bug Fixes

* Add RN SDK offline support through ConnectionMode. ([#361](https://github.com/launchdarkly/js-core/issues/361)) ([d97ce82](https://github.com/launchdarkly/js-core/commit/d97ce82861438a1b79b93799a9d061cdfa1ab027))
* Implement RN SDK EventSource jitter backoff. ([#359](https://github.com/launchdarkly/js-core/issues/359)) ([95e58bd](https://github.com/launchdarkly/js-core/commit/95e58bd666772b30b31ac98a462ca19407bc2bac))
* Improvements and fixes from docs review. ([#362](https://github.com/launchdarkly/js-core/issues/362)) ([ba07fbf](https://github.com/launchdarkly/js-core/commit/ba07fbf4ea0b505c4bdc6376b6b36d7a9c1e5fda))
* RN streamer connection in background and foreground. ([#360](https://github.com/launchdarkly/js-core/issues/360)) ([c69b768](https://github.com/launchdarkly/js-core/commit/c69b7686eed1971288adfbe527b4bf53ba5fe2b7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 0.1.2 to 0.2.0

## [0.1.5](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.4...react-native-client-sdk-v0.1.5) (2024-01-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 0.1.1 to 0.1.2

## [0.1.4](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.3...react-native-client-sdk-v0.1.4) (2024-01-03)


### Bug Fixes

* Add Detox e2e tests. ([#340](https://github.com/launchdarkly/js-core/issues/340)) ([e7b9d29](https://github.com/launchdarkly/js-core/commit/e7b9d299fe1e1c34489f8688099de466a12a3622))

## [0.1.3](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.2...react-native-client-sdk-v0.1.3) (2023-12-29)


### Bug Fixes

* Add more rn sdk unit tests. ([#339](https://github.com/launchdarkly/js-core/issues/339)) ([913bc00](https://github.com/launchdarkly/js-core/commit/913bc0009a39188b6b9785e5c4b4b79078061821))

## [0.1.2](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.1...react-native-client-sdk-v0.1.2) (2023-12-28)


### Bug Fixes

* Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))
* Remove release-as for sdk-client and rn sdk and updated READMEs. ([#337](https://github.com/launchdarkly/js-core/issues/337)) ([52bf088](https://github.com/launchdarkly/js-core/commit/52bf088bd9c7a75f673e37de829459bbad4deb90))

## [0.1.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.0...react-native-client-sdk-v0.1.1) (2023-12-28)


### Bug Fixes

* Remove release-as for sdk-client and rn sdk and updated READMEs. ([#337](https://github.com/launchdarkly/js-core/issues/337)) ([52bf088](https://github.com/launchdarkly/js-core/commit/52bf088bd9c7a75f673e37de829459bbad4deb90))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 0.1.0 to 0.1.1

## [0.1.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.1...react-native-client-sdk-v0.1.0) (2023-12-28)


### Bug Fixes

* Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))

## Changelog

### Dependencies



## Changelog

All notable changes to the LaunchDarkly SDK for React Native will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org).
