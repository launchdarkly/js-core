import got from 'got';

export default class TestHook {
  constructor(name, endpoint, data, errors) {
    this._name = name;
    this._endpoint = endpoint;
    this._data = data;
    this._errors = errors;
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
    if(this._errors?.beforeEvaluation) {
      throw new Error(this._errors.beforeEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'beforeEvaluation',
    });
    return { ...data, ...(this._data?.['beforeEvaluation'] || {}) };
  }

  afterEvaluation(hookContext, data, detail) {
    if(this._errors?.afterEvaluation) {
      throw new Error(this._errors.afterEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'afterEvaluation',
      evaluationDetail: detail,
    });


    return { ...data, ...(this._data?.['afterEvaluation'] || {}) };
  }
}
