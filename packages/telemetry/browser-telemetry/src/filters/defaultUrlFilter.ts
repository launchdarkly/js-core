const pollingRegex = /sdk\/evalx\/[^/]+\/contexts\/(?<context>[^/?]*)\??.*?/;
const streamingREgex = /\/eval\/[^/]+\/(?<context>[^/?]*)\??.*?/;

/**
 * Filter which removes context information for browser JavaScript endpoints.
 *
 * @param url URL to filter.
 * @returns A filtered URL.
 */
export default function defaultUrlFilter(url: string): string {
  // TODO: Maybe we consider a way to identify LD requests so they can be filtered without
  // regular expressions.

  if (url.includes('/sdk/evalx')) {
    const regexMatch = url.match(pollingRegex);
    const context = regexMatch?.groups?.context;
    if (context) {
      return url.replace(context, '*'.repeat(context.length));
    }
  }
  if (url.includes('/eval/')) {
    const regexMatch = url.match(streamingREgex);
    const context = regexMatch?.groups?.context;
    if (context) {
      return url.replace(context, '*'.repeat(context.length));
    }
  }
  return url;
}
