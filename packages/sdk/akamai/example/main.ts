import { logger } from 'log';
import { LDMultiKindContext } from '@launchdarkly/akamai-edgeworker-sdk';
// import { evaluateFlagFromCustomFeatureStore } from './ldClient/customFeatureStore';
import { evaluateFlagWithEdgeKV } from './ldClient/edgekv';

const createLDContext = (r: EW.IngressClientRequest): LDMultiKindContext => ({
  kind: 'multi',
  location: {
    key: 'context-key',
    country: r.userLocation.country,
  },
});

const createResponse = (text: string) => {
  return `<html><body><h1>${text}</h1></body></html>`;
};

export async function onClientRequest(request: EW.IngressClientRequest) {
  try {
    const showAds = await evaluateFlagWithEdgeKV('enable-ads', createLDContext(request), false);
    // const showAds = await evaluateFlagFromCustomFeatureStore(
    //   'enable-ads',
    //   createLDContext(request),
    //   false
    // );

    let response = createResponse('Ads are hidden');
    if (showAds) {
      response = createResponse('Showing random advertisements');
    }

    request.respondWith(200, {}, response);
  } catch (err) {
    request.respondWith(500, {}, `Something went wrong: ${err.toString()}`);
  }
}

export function onClientResponse(
  request: EW.EgressClientRequest,
  response: EW.EgressClientResponse
) {
  // Outputs a message to the X-Akamai-EdgeWorker-onClientResponse-Log header.
  logger.log('Adding a header in ClientResponse');

  response.setHeader('X-Hello-World', 'From Akamai EdgeWorkers');
}
