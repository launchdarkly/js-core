# LaunchDarkly JS Core — Development Guidelines

## Project Structure
- This is a monorepo containing multiple JavaScript SDK packages
- Packages are organized into categories:
  - Shared packages (common code)
  - SDK packages (platform-specific implementations)
  - Store packages (persistent storage)
  - Telemetry packages (monitoring)
  - Tooling packages (development tools)

## Build Requirements
- Node environment version 16 required (minimum)
- yarn required
- Some projects may have specific environment prerequisites

## Build Process
- Use `yarn` to install dependencies from project root
- Use `yarn build` to build all projects
- For single project builds:
  ```
  yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/js-client-sdk' run build
  ```
- Replace package name as needed
- Running `yarn build` in individual packages won't rebuild dependencies

## Pull Requests
- Always create pull requests as Draft Pull Requests unless explicitly instructed otherwise

## Dependency Management
- Dependencies should be avoided unless absolutely necessary
- Consider these factors when evaluating a dependency:
  - Size: Impact on final bundle size (especially important for browser SDK)
  - Maintenance: Risk of becoming unmaintained or deprecated
  - Security: Potential security vulnerabilities
  - Compatibility: Support across all target platforms
  - Conflicts: Potential conflicts with application dependencies
- Most important to avoid dependencies in: common, sdk-client, and sdk-server packages
- Individual SDK packages may have platform-specific dependencies
- Edge SDKs must use their provider's edge store and may require specific dependencies
- Only use dependencies for functionality with highly-specified behavior, wide usage, active maintenance, and large community support

## TypeScript Guidelines
- Aim for compiled JavaScript to not be substantially different than if written as JavaScript
- Consider JavaScript consumers when making TypeScript decisions
- Avoid TypeScript enumerations — use unions of strings instead:
  - Bad: `enum ValueType { Bool = 'bool', Int = 'int' }`
  - Good: `type ValueType = 'bool' | 'int'`
- Prefer interfaces over classes when reasonable, especially for public APIs
- Remember that `private` and `readonly` only affect TypeScript — JavaScript can still access and mutate
- For private members that need to be minified, prefix with underscore

## Testing Guidelines
- Unit tests go in a `__tests__` folder at the root of each package
- Directory structure inside `__tests__` should mirror the source directory
- Run tests only for single projects at a time: `yarn workspace <package name> test`
- Use `it` for test cases (should read as a sentence including `it`):
  - Good: `it('does not load flags prior to start', async () => { ... })`
- Use `describe` blocks only for shared setup across a series of tests:
  - Good: `describe('given a mock filesystem and memory feature store', () => { ... })`
  - If there is no shared configuration, do not use a describe block
- Run unit tests for any package you've modified

## Linting Guidelines
- Run lint checks with: `yarn workspace <package name> lint`
- Auto-fix many issues with: `yarn workspace <package name> lint --fix`
- Package names are in each package's `package.json`
- Run lint on any package you've modified
- When working with mocks in tests, `@ts-ignore` or ESLint ignore comments are acceptable for typing issues (test code only, not implementation)
