# Changelog

## [10.7.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.6.1...react-native-client-sdk-v10.7.0) (2024-09-26)


### Features

* Add support for conditional event source capabilities. ([#577](https://github.com/launchdarkly/js-core/issues/577)) ([fe82500](https://github.com/launchdarkly/js-core/commit/fe82500f28cf8d8311502098aa6cc2e73932064e))
* Add support for js-client-sdk style initialization. ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))
* Adds support for REPORT. ([#575](https://github.com/launchdarkly/js-core/issues/575)) ([916b724](https://github.com/launchdarkly/js-core/commit/916b72409b63abdf350e70cca41331c4204b6e95))
* Refactor data source connection handling.  ([53f5bb8](https://github.com/launchdarkly/js-core/commit/53f5bb89754ff05405d481a959e75742fbd0d0a9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.7.0 to 1.8.0

## [10.6.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.6.0...react-native-client-sdk-v10.6.1) (2024-09-03)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.6.0 to 1.7.0

## [10.6.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.5.1...react-native-client-sdk-v10.6.0) (2024-08-28)


### Features

* custom storage option for React Native SDK ([#539](https://github.com/launchdarkly/js-core/issues/539)) ([115bd82](https://github.com/launchdarkly/js-core/commit/115bd828c665731084665b5d94bb3836942332b1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.5.0 to 1.6.0

## [10.5.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.5.0...react-native-client-sdk-v10.5.1) (2024-08-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.4.0 to 1.5.0

## [10.5.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.4.0...react-native-client-sdk-v10.5.0) (2024-08-15)


### Features

* Remove event target shim. ([#545](https://github.com/launchdarkly/js-core/issues/545)) ([448ad67](https://github.com/launchdarkly/js-core/commit/448ad67815b9ec29abd322ed8483b2367147b146)), closes [#412](https://github.com/launchdarkly/js-core/issues/412)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.3.0 to 1.4.0

## [10.4.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.3.1...react-native-client-sdk-v10.4.0) (2024-08-12)


### Features

* Add configuration validation for ReactNative specific configuration. ([#532](https://github.com/launchdarkly/js-core/issues/532)) ([c1490e2](https://github.com/launchdarkly/js-core/commit/c1490e22d0b3fb4d7df878aabab0ea24db502fb6))
* Add connection mananger. ([#522](https://github.com/launchdarkly/js-core/issues/522)) ([5bf8b16](https://github.com/launchdarkly/js-core/commit/5bf8b16e26e7d8cbbd18524f1c13f773de457b82))
* Implement polling support. ([#524](https://github.com/launchdarkly/js-core/issues/524)) ([a99048e](https://github.com/launchdarkly/js-core/commit/a99048e0cebaafd536f79114c4727524b8f7357d))
* Refactor application state handling. ([#523](https://github.com/launchdarkly/js-core/issues/523)) ([f5b81e6](https://github.com/launchdarkly/js-core/commit/f5b81e6fc571dc9d97a18d07f382c77cd938fd65))


### Bug Fixes

* Fix field visibility. ([#530](https://github.com/launchdarkly/js-core/issues/530)) ([21fb18b](https://github.com/launchdarkly/js-core/commit/21fb18b40139583b44a4185fb689b043547641ab))
* Handle non-status code errors for streaming connection. ([#533](https://github.com/launchdarkly/js-core/issues/533)) ([fc4645e](https://github.com/launchdarkly/js-core/commit/fc4645eb7d70425e7ea615e275e5ad1e488365d4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.2.0 to 1.3.0

## [10.3.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.3.0...react-native-client-sdk-v10.3.1) (2024-07-31)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.5 to 1.2.0

## [10.3.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.2.1...react-native-client-sdk-v10.3.0) (2024-07-19)


### Features

* Update expo and RN version used in example. ([#520](https://github.com/launchdarkly/js-core/issues/520)) ([b8384c4](https://github.com/launchdarkly/js-core/commit/b8384c41243fb7475439cc634459b5156e05791b))


### Bug Fixes

* Make it more clear what is happening when an event source is connecting. ([#518](https://github.com/launchdarkly/js-core/issues/518)) ([52055ba](https://github.com/launchdarkly/js-core/commit/52055ba603349c6a2d94e25c58813765d4d9abd9))

## [10.2.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.2.0...react-native-client-sdk-v10.2.1) (2024-07-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.4 to 1.1.5

## [10.2.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.5...react-native-client-sdk-v10.2.0) (2024-07-02)


### Bug Fixes

* Corrected example app flag key. ([#493](https://github.com/launchdarkly/js-core/issues/493)) ([e1d2d30](https://github.com/launchdarkly/js-core/commit/e1d2d3061246421e9931d4ec271d477fcbede265))

## [10.1.5](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.4...react-native-client-sdk-v10.1.5) (2024-06-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.3 to 1.1.4

## [10.1.4](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.3...react-native-client-sdk-v10.1.4) (2024-05-31)


### Bug Fixes

* Added iOS SettingsManager null check. ([#471](https://github.com/launchdarkly/js-core/issues/471)) ([8ff641b](https://github.com/launchdarkly/js-core/commit/8ff641be8b32f24884457bd506566e283cf04e40))

## [10.1.3](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.2...react-native-client-sdk-v10.1.3) (2024-04-26)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.2 to 1.1.3

## [10.1.2](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.1...react-native-client-sdk-v10.1.2) (2024-04-25)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.1 to 1.1.2

## [10.1.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.1.0...react-native-client-sdk-v10.1.1) (2024-04-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.1.0 to 1.1.1

## [10.1.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.5...react-native-client-sdk-v10.1.0) (2024-04-09)


### Features

* Add identify timeout to client-sdk. ([#420](https://github.com/launchdarkly/js-core/issues/420)) ([5d73dfe](https://github.com/launchdarkly/js-core/commit/5d73dfeb0d5cdacf620e65e214dd2e334363490e))

### Bug Fixes

* Identify incorrectly rejected in client-sdk ([#426](https://github.com/launchdarkly/js-core/issues/426)) ([a019dd6](https://github.com/launchdarkly/js-core/commit/a019dd66b1b852d888e10b78aec9693d7de195fe))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @launchdarkly/js-client-sdk-common bumped from 1.0.3 to 1.1.0

## [10.0.5](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.4...react-native-client-sdk-v10.0.5) (2024-03-27)

### Bug Fixes

- Stream retry failure due to previous open connection. ([#409](https://github.com/launchdarkly/js-core/issues/409)) ([ae08e08](https://github.com/launchdarkly/js-core/commit/ae08e08470d954a683940c4263f3274ac73c4206))

## [10.0.4](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.3...react-native-client-sdk-v10.0.4) (2024-03-25)

### Bug Fixes

- Send identify event. ([#407](https://github.com/launchdarkly/js-core/issues/407)) ([1d73462](https://github.com/launchdarkly/js-core/commit/1d73462914cd35925d34a84b61492a52406b4083))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 1.0.2 to 1.0.3

## [10.0.3](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.2...react-native-client-sdk-v10.0.3) (2024-03-15)

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 1.0.1 to 1.0.2

## [10.0.2](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v10.0.1...react-native-client-sdk-v10.0.2) (2024-03-05)

### Bug Fixes

- Guard against null auto env attributes and async-storage. ([#384](https://github.com/launchdarkly/js-core/issues/384)) ([14ce392](https://github.com/launchdarkly/js-core/commit/14ce392ade486fa8168d2dae8375e4c201912f83))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 1.0.0 to 1.0.1

## [10.0.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.2.1...react-native-client-sdk-v10.0.0) (2024-02-08)

### Introducing `@launchdarkly/react-native-client-sdk` as a replacement for `launchdarkly-react-native-client-sdk`.

- The SDK has been re-written in Typescript.
- Supports Expo.
- The SDK has been moved to a new [repository](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-native) in github.
- The SDK has a new [package name](https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk).

### Features

- React Native SDK major release. ([#369](https://github.com/launchdarkly/js-core/issues/369)) ([1d5ca40](https://github.com/launchdarkly/js-core/commit/1d5ca40888c4db4bb938884ca55732750fb10614))

### Bug Fixes

- Fix Detox e2e tests broken after 0.73 update. ([#366](https://github.com/launchdarkly/js-core/issues/366)) ([6349b98](https://github.com/launchdarkly/js-core/commit/6349b98e70554d8240f0e8d6b1090e4c37bde6eb))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 0.2.1 to 1.0.0

## [0.2.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.2.0...react-native-client-sdk-v0.2.1) (2024-02-07)

### Bug Fixes

- Babel TypeError due to event-target-shim ([#365](https://github.com/launchdarkly/js-core/issues/365)) ([c1c0086](https://github.com/launchdarkly/js-core/commit/c1c008610f36c8dd0c1e3da3cf9450c64d41874f))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 0.2.0 to 0.2.1

## [0.2.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.5...react-native-client-sdk-v0.2.0) (2024-02-06)

### Features

- React-native support for auto-env attributes. Only affects react-native package. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))
- Update eslint jest configuration and versions. ([deea99c](https://github.com/launchdarkly/js-core/commit/deea99ca2fbb3865f2ce55a83b2cf12e0ae2db5e))

### Bug Fixes

- Add RN SDK offline support through ConnectionMode. ([#361](https://github.com/launchdarkly/js-core/issues/361)) ([d97ce82](https://github.com/launchdarkly/js-core/commit/d97ce82861438a1b79b93799a9d061cdfa1ab027))
- Implement RN SDK EventSource jitter backoff. ([#359](https://github.com/launchdarkly/js-core/issues/359)) ([95e58bd](https://github.com/launchdarkly/js-core/commit/95e58bd666772b30b31ac98a462ca19407bc2bac))
- Improvements and fixes from docs review. ([#362](https://github.com/launchdarkly/js-core/issues/362)) ([ba07fbf](https://github.com/launchdarkly/js-core/commit/ba07fbf4ea0b505c4bdc6376b6b36d7a9c1e5fda))
- RN streamer connection in background and foreground. ([#360](https://github.com/launchdarkly/js-core/issues/360)) ([c69b768](https://github.com/launchdarkly/js-core/commit/c69b7686eed1971288adfbe527b4bf53ba5fe2b7))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 0.1.2 to 0.2.0

## [0.1.5](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.4...react-native-client-sdk-v0.1.5) (2024-01-16)

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 0.1.1 to 0.1.2

## [0.1.4](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.3...react-native-client-sdk-v0.1.4) (2024-01-03)

### Bug Fixes

- Add Detox e2e tests. ([#340](https://github.com/launchdarkly/js-core/issues/340)) ([e7b9d29](https://github.com/launchdarkly/js-core/commit/e7b9d299fe1e1c34489f8688099de466a12a3622))

## [0.1.3](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.2...react-native-client-sdk-v0.1.3) (2023-12-29)

### Bug Fixes

- Add more rn sdk unit tests. ([#339](https://github.com/launchdarkly/js-core/issues/339)) ([913bc00](https://github.com/launchdarkly/js-core/commit/913bc0009a39188b6b9785e5c4b4b79078061821))

## [0.1.2](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.1...react-native-client-sdk-v0.1.2) (2023-12-28)

### Bug Fixes

- Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))
- Remove release-as for sdk-client and rn sdk and updated READMEs. ([#337](https://github.com/launchdarkly/js-core/issues/337)) ([52bf088](https://github.com/launchdarkly/js-core/commit/52bf088bd9c7a75f673e37de829459bbad4deb90))

## [0.1.1](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.0...react-native-client-sdk-v0.1.1) (2023-12-28)

### Bug Fixes

- Remove release-as for sdk-client and rn sdk and updated READMEs. ([#337](https://github.com/launchdarkly/js-core/issues/337)) ([52bf088](https://github.com/launchdarkly/js-core/commit/52bf088bd9c7a75f673e37de829459bbad4deb90))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @launchdarkly/js-client-sdk-common bumped from 0.1.0 to 0.1.1

## [0.1.0](https://github.com/launchdarkly/js-core/compare/react-native-client-sdk-v0.1.1...react-native-client-sdk-v0.1.0) (2023-12-28)

### Bug Fixes

- Remove beta warning for sdk-server. Added tsdoc comments for rn sdk. Added README for sdk-client. ([#334](https://github.com/launchdarkly/js-core/issues/334)) ([bb7c3b4](https://github.com/launchdarkly/js-core/commit/bb7c3b45a72d203ad7209def3982d9094fb4cbc9))

## Changelog

### Dependencies

## Changelog

All notable changes to the LaunchDarkly SDK for React Native will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org).
