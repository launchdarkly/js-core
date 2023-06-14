export default function Closed() {
  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-44px)] justify-center bg-gray-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid"
        viewBox="0 0 256 315"
        className="w-16 h-16 text-black"
      >
        <path
          fill="currentColor"
          d="M213.803 167.03c.442 47.58 41.74 63.413 42.197 63.615-.35 1.116-6.599 22.563-21.757 44.716-13.104 19.153-26.705 38.235-48.13 38.63-21.05.388-27.82-12.483-51.888-12.483-24.061 0-31.582 12.088-51.51 12.871-20.68.783-36.428-20.71-49.64-39.793-27-39.033-47.633-110.3-19.928-158.406 13.763-23.89 38.36-39.017 65.056-39.405 20.307-.387 39.475 13.662 51.889 13.662 12.406 0 35.699-16.895 60.186-14.414 10.25.427 39.026 4.14 57.503 31.186-1.49.923-34.335 20.044-33.978 59.822M174.24 50.199c10.98-13.29 18.369-31.79 16.353-50.199-15.826.636-34.962 10.546-46.314 23.828-10.173 11.763-19.082 30.589-16.678 48.633 17.64 1.365 35.66-8.964 46.64-22.262"
        />
      </svg>
      <h1 className="text-5xl tracking-tight max-w-3xl font-semibold mb-4 mt-10">
        We&apos;ll be back.
      </h1>
      <p className="ml-4 text-gray-500 text-xl">
        We&apos;re busy updating the Apple Store for you and will be back soon.
      </p>
    </div>
  );
}
