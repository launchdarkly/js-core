// This file contains temporary patches that will be accomplished
// with SDK modifications in the future.

const sessionId = crypto.randomUUID();
const sessionTag = `session-id/${sessionId}`;

class HeaderModifyingXMLHttpRequest extends XMLHttpRequest {
  private tagsHeaderSet = false;
  private isLikelyLdSdk = false;

  override setRequestHeader(name: string, value: string): void {
    if (name.toLowerCase() === 'x-launchdarkly-user-agent') {
      this.isLikelyLdSdk = true;
    }
    const tagsHeader = name === 'x-launchdarkly-tags';
    const finalValue = tagsHeader ? `${value} ${sessionTag}` : value;
    super.setRequestHeader(name, finalValue);
    if (tagsHeader) {
      this.tagsHeaderSet = true;
    }
  }

  override send(body?: Document | XMLHttpRequestBodyInit | null | undefined): void {
    if (!this.tagsHeaderSet && this.isLikelyLdSdk) {
      super.setRequestHeader('x-launchdarkly-tags', sessionTag);
    }
    super.send(body);
  }
}

export default function applyPatches(): void {
  window.XMLHttpRequest = HeaderModifyingXMLHttpRequest;
}
