> [!IMPORTANT]  
> This is an experimental project to demonstrate the use of LaunchDarkly with Next.js App Router.
>
> This is designed for the App Router. Pages router is not supported.

This example app uses the LaunchDarkly React Universal SDK. It features:

- Server side rendering with both Server Components and Client Components.
- A Client Component example in [app/components/helloClientComponent.tsx](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-universal/example/app/components/helloClientComponent.tsx)
- A Server Component (RSC) example in [app/components/helloServerComponent.tsx](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-universal/example/app/components/helloServerComponent.tsx)
- Out of the box bootstrapping.

This is a [Next.js](https://nextjs.org/) project created with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) using App Router.

## Quickstart

1. Rename `.example.env.local` to `.env.local` and use your LaunchDarkly SDK keys:

```dotenv
LD_SDK_KEY='<YOUR LD SERVER SDK KEY>'
NEXT_PUBLIC_LD_CLIENT_SIDE_ID='<YOUR LD CLIENT SDK KEY>'
```

2. Either create `my-boolean-flag-1` in your LaunchDarkly environment or replace with your own flag in [helloClientComponent.tsx](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-universal/example/app/components/helloClientComponent.tsx) and [helloServerComponent.tsx](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-universal/example/app/components/helloServerComponent.tsx).

3. Finally:

```bash
npm i && npm run dev

# or
yarn && yarn dev
```

You will see both Server and Client Components are rendered on the server (view source on your browser). However, only Client Components will respond to live changes because Server Components are excluded from the client bundle.
