# Contributing to the monorepo for JavaScript SDKs

LaunchDarkly has published an [SDK contributor's guide](https://docs.launchdarkly.com/sdk/concepts/contributors-guide) that provides a detailed explanation of how our SDKs work. See below for additional information on how to contribute to this SDK.

## Submitting bug reports and feature requests

The LaunchDarkly SDK team monitors the [issue tracker](https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc) in the SDK repository. Bug reports and feature requests specific to this SDK should be filed in this issue tracker. The SDK team will respond to all newly filed issues within two business days.

## Submitting pull requests

We encourage pull requests and other contributions from the community. Before submitting pull requests, ensure that all temporary or unintended code is removed. Don't worry about adding reviewers to the pull request; the LaunchDarkly SDK team will add themselves. The SDK team will acknowledge all pull requests within two business days.

## Build instructions

### Prerequisites

A node environment of version 16 and npm or yarn are required to develop in this repository.

This monorepo may contain projects that are not suitable for execution using node, and those
projects will have specific environment prerequisites.

### Setup

To install project dependencies, from the project root directory:

```
yarn
```

### Build

To build all projects, from the root directory:

```
yarn build
```

### Testing

Unit tests should be implemented in a `__tests__` folder in the root of the package. The directory structure inside of `__tests__` should mirror that of the source directory.

Each package has its own testing requirements and tests should be only ran for single projects.

To run the SDK contract test suite (see [`contract-tests/README.md`](./contract-tests/README.md)):
The SDK contract test suite will run the Node.js Server version of the SDK.

```bash
yarn run contract-tests
```

Tests cases should be written using `it` and should read as a sentence including the `it`:
```TypeScript
it('does not load flags prior to start', async () => {/* test code */}
```

Describe blocks should be used for common setup for a series of tests:
```TypeScript
describe('given a mock filesystem and memory feature store', { /* tests */})
```

These then combined to create an understandable test name:
`given a mock filesystem and memory feature store > it does not load flags prior to start`

## Development Guidelines

These are a series of recommendations for developing code in this repository. Not all existing code will comply
with these guidelines, but new code should unless there are specific reasons not to.

While we develop code in TypeScript we generally want to aim for the compiled JavaScript to not be substantially different than if it had been written as JavaScript.

### Avoid using TypeScript enumerations. Instead use unions of strings.

Bad:
```TypeScript
export enum ValueType {
  Bool = 'bool',
  Int = 'int',
  Double = 'double',
  String = 'string',
  Any = 'any',
}
```

Good:
```TypeScript
export type ValueType = 'bool' | 'int' | 'double' | 'string' | 'any'
```

While we are using TypeScript not all consumers of our code will be. Using a TypeScript enum from JavaScript is not very ergonomic.
Additionally the code size associated with enums is going to be larger. The enum actually generates code, where the union provides type safety, but has no impact on the generated code.

### Prefer interfaces over classes when reasonable, especially if publicly exposed.

Bad:
```TypeScript
class MyData {
  public mutable: string;
  constructor(private readonly value: string private readonly another: string);
}
```

Good:
```TypeScript
interface MyData {
  readonly value: string;
  readonly another: string;
  mutable: string;
}

function createMyData(value: string, another: string, mutable: string): MyData {
  return {
    value,
    another,
    mutable
  }
}
```

There are several potential problems using classes and some of them may be unexpected.

Classes produce JavaScript code while interfaces only represent contracts and don't exist in the generated JavaScript. In client-side applications keeping size to a minimum is very important.

The minification of associated functions is also another major difference. Functions that are not exported from the package can have their names minified. Methods that are part of a class are generally not minified.

A number of classes are present in the SDKs that cannot be removed without a major version. In order to reduce the size of these classes we have added support for minification of any member that starts with an underscore.

Another thing to remember is that the private and readonly only really affect TypeScript. Using JavaScript you can still access and mutate. Our minification of private members starting with an underscore also helps prevent unintentional usage from JavaScript.
