import HelloIdentify from '@/app/components/helloIdentify';

export default async function Page() {
  return (
    <div className="grid h-screen">
      <div className=" grid text-center justify-center items-center">
        <div className="space-y-8">
          <p className="text-5xl font-audimat ldgradient w-3/4 mx-auto">Login page</p>
          <p className="text-lg font-audimat pb-4 w-2/3 mx-auto">
            To evaluate the flags below, create a boolean flag with a key of{' '}
            <span className="text-blue-500 font-bold">my-boolean-flag-1</span> with the Client-SDK
            switch enabled. This flag will be evaluated by both the client SDK and server SDKs.
          </p>
          <div className="grid gap-4 w-1/3 mx-auto">
            <HelloIdentify />
          </div>
        </div>
      </div>
    </div>
  );
}
