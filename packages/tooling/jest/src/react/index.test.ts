import { renderHook } from '@testing-library/react-hooks'
import { useFlags, useLDClient, useLDClientError, LDProvider, asyncWithLDProvider } from 'launchdarkly-react-client-sdk'
import { mockFlags, ldClientMock, resetLDMocks } from './index'

describe('main', () => {

  test('mock kebab-case correctly', () => {
    mockFlags({ 'dev-test-flag': true })

    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useFlags())

    expect(current.devTestFlag).toBeTruthy()
    // Received: undefined
    expect(current['dev-test-flag']).toBeTruthy()
  })

  test('mock camelCase correctly', () => {
    mockFlags({ devTestFlag: true })

    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useFlags())

    expect(current.devTestFlag).toBeTruthy()
    // Received: undefined
    expect(current['dev-test-flag']).toBeTruthy()
  })

  test('mock option without case formatting correctly', () => {
    mockFlags({ DEV_test_Flag: true })

    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useFlags())

    expect(current.DEV_test_Flag).toBeTruthy()
    // Received: undefined
    expect(current['DEV_test_Flag']).toBeTruthy()
  })

  test('mock useLDClientError correctly', () => {
    expect(useLDClientError).toBeDefined()
  })

  test('mock asyncWithLDProvider correctly', () => {
    expect(asyncWithLDProvider).toBeDefined()
  })

  test('mock asyncWithLDProvider returns promise of a value function', (done) => {
// [LaunchDarkly] The waitForInitialization function was called without a timeout specified. In a future version a default timeout will be applied.
// [LaunchDarkly] Environment not found. Double check that you specified a valid environment/client-side ID. 
// Please see https://docs.launchdarkly.com/sdk/client-side/javascript#initialize-the-client for instructions on SDK initialization.

// mock asyncWithLDProvider returns promise of a value function
// thrown: "Exceeded timeout of 5000 ms for a test while waiting for `done()` to be called.
// Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."
const providerPromise = asyncWithLDProvider({ clientSideID: 'someid' })

    // mock asyncWithLDProvider returns promise of a value function
    // Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
    // 1. You might have mismatching versions of React and the renderer (such as React DOM)
    // 2. You might be breaking the Rules of Hooks
    // 3. You might have more than one copy of React in the same app
    // See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.
    expect(providerPromise).toBeInstanceOf(Promise)

    providerPromise.then((provider) => {
      expect(provider).toBeInstanceOf(Function)

      expect(provider({ children: 'child' })).toEqual('child')

      done()
    })
  })

  test('mock LDProvider correctly', () => {
    expect(LDProvider).toBeDefined()
  })

  test('mock ldClient correctly', () => {
    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useLDClient())

    current?.track('page-view')

    expect(ldClientMock.track).toHaveBeenCalledTimes(1)
  })

  test('ldClient mock has complete set of methods', () => {
    expect(ldClientMock.track.mock).toBeDefined()
    expect(ldClientMock.identify.mock).toBeDefined()
    expect(ldClientMock.allFlags.mock).toBeDefined()
    expect(ldClientMock.close.mock).toBeDefined()
    expect(ldClientMock.flush.mock).toBeDefined()
    expect(ldClientMock.getContext.mock).toBeDefined()
    expect(ldClientMock.off.mock).toBeDefined()
    expect(ldClientMock.on.mock).toBeDefined()
    expect(ldClientMock.setStreaming.mock).toBeDefined()
    expect(ldClientMock.variation.mock).toBeDefined()
    expect(ldClientMock.variationDetail.mock).toBeDefined()
    expect(ldClientMock.waitForInitialization.mock).toBeDefined()
    expect(ldClientMock.waitUntilGoalsReady.mock).toBeDefined()
    expect(ldClientMock.waitUntilReady.mock).toBeDefined()
  })

  test('reset all flag mocks', () => {
    mockFlags({ devTestFlag: true })

    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useFlags())

    // Received: undefined
    expect(current.devTestFlag).toBeTruthy()

    resetLDMocks()

    const {
      result: { current: current2 },
    } = renderHook(() => useFlags())

    expect(current2).toEqual({})
  })

  test('initial useFlags value', () => {
    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useFlags())

    expect(current).toEqual({})
  })

  test('reset ldClientMock ', () => {
    const {
      result: { current },
// Warning: ReactDOM.render is no longer supported in React 18. Use createRoot instead. 
// Until you switch to the new API, your app will behave as if it's running React 17. 
// Learn more: https://reactjs.org/link/switch-to-createroot
    } = renderHook(() => useLDClient())
    // TypeError: Cannot read properties of undefined (reading 'track')
    current?.track('page-view')

    resetLDMocks()

    expect(ldClientMock.track).not.toHaveBeenCalled()
  })
})