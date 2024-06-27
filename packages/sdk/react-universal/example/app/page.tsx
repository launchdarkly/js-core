import HelloClientComponent from './components/helloClientComponent';
import HelloServerComponent from './components/helloServerComponent';

// GOTCHA: page components must be async. Otherwise the ssr cache may not be initialized correctly.
export default async function Page() {
  return (
    <div className="grid h-screen">
      <div className=" grid text-center justify-center items-center">
        <div className="space-y-8">
          <h1 className="text-3xl text-white font-bold font-audimat">Hello From LaunchDarkly!</h1>
          <p className="text-5xl font-audimat ldgradient w-3/4 mx-auto">
            This is a Next.js 14 template with LaunchDarkly
          </p>
          <p className="text-lg font-audimat pb-4 w-2/3 mx-auto">
            To evaluate the flags below, create a boolean flag with a key of{' '}
            <span className="text-blue-500 font-bold">my-boolean-flag-1</span> with the Client-SDK
            switch enabled. This flag will be evaluated by both the client SDK and server SDKs.
          </p>
          <div className="grid gap-4 w-1/3 mx-auto">
            <HelloClientComponent />
            <HelloServerComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
