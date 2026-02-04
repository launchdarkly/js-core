NOTE: We are separating the source into 3 root implementations on purpose. Currently, the build
will choose the `client` code as the root `@launchdarkly/react-sdk` import. The other packages are
`@launchdarkly/react-sdk/server` and `@launchdarkly/react-sdk/isomorphic`. I can see a scenario where
we would want `@launchdarkly/react-sdk/isomorphic` as root, but I am still convinced that the client side
rendering is still the most popular way to do React.