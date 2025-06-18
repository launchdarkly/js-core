# LaunchDarkly Jest

[![NPM][jest-npm-badge]][jest-npm-link]
[![Actions Status][jest-ci-badge]][jest-ci]
[![Documentation][jest-ghp-badge]][jest-ghp-link]
[![NPM][jest-dm-badge]][jest-npm-link]
[![NPM][jest-dt-badge]][jest-npm-link]

> [!CAUTION]
> This library is a beta version and should not be considered ready for production use while this message is visible.

> **Easily unit test LaunchDarkly applications with jest** :clap:

For more information, see the [complete reference guide for unit testing](https://docs.launchdarkly.com/guides/sdk/unit-tests).

## Installation

```shell
# npm
npm i @launchdarkly/jest --save-dev

# yarn
yarn add -D @launchdarkly/jest
```

Then in `jest.config.js` add `@launchdarkly/jest/{framework}` to setupFiles:

```js
// jest.config.js
module.exports = {
  // for react-native
  setupFiles: ['@launchdarkly/jest/react-native'],
};
```

## Quickstart

describe('Welcome component test', () => {
  afterEach(() => {
    resetLDMocks();
  });

  test('mock boolean flag correctly', () => {
    mockFlags({ 'my-boolean-flag': true });
    render(<Welcome />);
    expect(screen.getByText('Flag value is true')).toBeTruthy();
  });

  test('mock ldClient correctly', () => {
    const current = useLDClient();

    current?.track('event');
    expect(current.track).toHaveBeenCalledTimes(1);
  });
});

## Developing this package

```shell
# at js-core repo root
yarn && yarn build && cd packages/tooling/jest

# run tests
yarn test
```

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[jest-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/jest.yml/badge.svg
[jest-ci]: https://github.com/launchdarkly/js-core/actions/workflows/jest.yml
[jest-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/jest.svg?style=flat-square
[jest-npm-link]: https://www.npmjs.com/package/@launchdarkly/jest
[jest-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[jest-ghp-link]: https://launchdarkly.github.io/js-core/packages/tooling/jest/docs/
[jest-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/jest.svg?style=flat-square
[jest-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/jest.svg?style=flat-square
