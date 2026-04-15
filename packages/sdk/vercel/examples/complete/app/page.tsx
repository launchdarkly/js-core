import { FLAG_HEADER, flagKey } from 'lib/ldEdgeClient';
import { headers } from 'next/headers';

import FlagDisplay from './FlagDisplay';

// The middleware evaluates the flag and attaches it as a header on the request.
// This lets the server-render the initial state without a client-side fetch.
export default async function Home() {
  const headersList = await headers();
  const middlewareValue = headersList.get(FLAG_HEADER);

  const initialState =
    middlewareValue !== null
      ? { flagKey, flagValue: middlewareValue === 'true' }
      : undefined;

  return <FlagDisplay initialState={initialState} />;
}
