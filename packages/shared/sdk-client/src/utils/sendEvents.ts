const sendEvents = (events, url, isDiagnostic) => {
  if (!platform.httpRequest) {
    return Promise.resolve();
  }

  const jsonBody = JSON.stringify(events);
  const payloadId = isDiagnostic ? null : uuidv1();

  function doPostRequest(canRetry) {
    const headers = isDiagnostic
      ? baseHeaders
      : utils.extend({}, baseHeaders, {
          'X-LaunchDarkly-Event-Schema': '4',
          'X-LaunchDarkly-Payload-ID': payloadId,
        });
    return platform
      .httpRequest('POST', url, transformHeaders(headers, options), jsonBody)
      .promise.then((result) => {
        if (!result) {
          // This was a response from a fire-and-forget request, so we won't have a status.
          return;
        }
        if (result.status >= 400 && errors.isHttpErrorRecoverable(result.status) && canRetry) {
          return doPostRequest(false);
        } else {
          return getResponseInfo(result);
        }
      })
      .catch(() => {
        if (canRetry) {
          return doPostRequest(false);
        }
        return Promise.reject();
      });
  }

  return doPostRequest(true).catch(() => {});
};

export default sendEvents;
