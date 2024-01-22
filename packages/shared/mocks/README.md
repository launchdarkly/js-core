# LaunchDarkly SDK JavaScript Mocks

[![Actions Status][mocks-ci-badge]][mocks-ci]

> [!CAUTION]
> Internal use only.
> This project contains JavaScript mocks that are consumed in unit tests in client-side and server-side JavaScript SDKs.

## Installation

This package is not published publicly. To use it internally, add the following line to your project's package.json
devDependencies. yarn workspace has been setup to recognize this package so this dependency should automatically work:

```bash
  "devDependencies": {
    "@launchdarkly/private-js-mocks": "0.0.1",
    ...
```

Then in your jest config add `@launchdarkly/private-js-mocks/setup` to setupFilesAfterEnv:

```js
// jest.config.js or jest.config.json
module.exports = {
  setupFilesAfterEnv: ['@launchdarkly/private-js-mocks/setup'],
  ...
}
```

## Usage

> [!IMPORTANT]  
> basicPlatform must be used inside a test because it's setup before each test.

- `basicPlatform`: a concrete but basic implementation of [Platform](https://github.com/launchdarkly/js-core/blob/main/packages/shared/common/src/api/platform/Platform.ts). This is setup beforeEach so it must be used inside a test.

- `hasher`: a Hasher object returned by `Crypto.createHash`. All functions in this object are jest mocks. This is exported
  separately as a top level export because `Crypto` does not expose this publicly and we want to respect that.

## Example

```tsx
import { basicPlatform, hasher } from '@launchdarkly/private-js-mocks';

// DOES NOT WORK: crypto is undefined because basicPlatform must be inside a test
// because it's setup by the package in beforeEach.
// const { crypto } = basicPlatform; // DON'T DO THIS

describe('button', () => {
  let crypto: Crypto;

  beforeEach(() => {
    // WORKS: basicPlatform has been setup by the package
    crypto = basicPlatform.crypto; // DO THIS
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('hashes the correct string', () => {
    // arrange
    const bucketer = new Bucketer(crypto);

    // act
    const [bucket, hadContext] = bucketer.bucket();

    // assert
    expect(crypto.createHash).toHaveBeenCalled();

    // GOTCHA: hasher is a separte import from crypto to respect
    // the public Crypto interface.
    expect(hasher.update).toHaveBeenCalledWith(expected);
    expect(hasher.digest).toHaveBeenCalledWith('hex');
  });
});
```

## Developing this package

If you make changes to this package, you'll need to run `yarn build` in the `mocks` directory for changes to take effect.

## Contributing

See [Contributing](../shared/CONTRIBUTING.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[mocks-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/mocks.yml/badge.svg
[mocks-ci]: https://github.com/launchdarkly/js-core/actions/workflows/mocks.yml
