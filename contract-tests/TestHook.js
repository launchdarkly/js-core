import got from 'got';

export default class TestHook {
  constructor(name, endpoint, data) {
    this._name = name;
    this._endpoint = endpoint;
    this._data = data;
  }

  async _safePost(body) {
    try {
      await got.post(this._endpoint, { json: body });
    } catch {
      // The test could move on before the post, so we are ignoring
      // failed posts.
    }
  }

  getMetadata() {
    return {
      name: 'LaunchDarkly Tracing Hook',
    };
  }

  beforeEvaluation(hookContext, data) {
    this._safePost({
      evaluationHookContext: hookContext,
      evaluationHookData: data,
      stage: 'beforeEvaluation',
    });
    return { ...data, ...(this._data?.['beforeEvaluation'] || {}) };
  }

  afterEvaluation(hookContext, data, detail) {
    this._safePost({
      evaluationHookContext: hookContext,
      evaluationHookData: data,
      stage: 'afterEvaluation',
      evaluationDetail: detail,
    });

    return { ...data, ...(this._data?.['afterEvaluation'] || {}) };
  }
}
