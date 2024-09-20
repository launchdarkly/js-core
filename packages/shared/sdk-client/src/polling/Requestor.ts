// eslint-disable-next-line max-classes-per-file
import { HttpErrorResponse, Requests } from '@launchdarkly/js-sdk-common';

function isOk(status: number) {
  return status >= 200 && status <= 299;
}

export class LDRequestError extends Error implements HttpErrorResponse {
  public status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'LaunchDarklyRequestError';
  }
}

/**
 * Note: The requestor is implemented independently from polling such that it can be used to
 * make a one-off request.
 */
export default class Requestor {
  constructor(
    private requests: Requests,
    private readonly uri: string,
    private readonly headers: { [key: string]: string },
    private readonly method: string,
    private readonly body?: string,
  ) {}

  async requestPayload(): Promise<string> {
    let status: number | undefined;
    try {
      const res = await this.requests.fetch(this.uri, {
        method: this.method,
        headers: this.headers,
        body: this.body,
      });
      if (isOk(res.status)) {
        return await res.text();
      }
      // Assigning so it can be thrown after the try/catch.
      status = res.status;
    } catch (err: any) {
      throw new LDRequestError(err?.message);
    }
    throw new LDRequestError(`Unexpected status code: ${status}`, status);
  }
}
