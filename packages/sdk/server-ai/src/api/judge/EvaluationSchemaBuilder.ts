/**
 * Internal class for building dynamic evaluation response schemas.
 * Not exported - only used internally by TrackedJudge.
 */
class EvaluationSchemaBuilder {
  static build(evaluationMetricKeys: string[]): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        evaluations: {
          type: 'object',
          description: `Object containing evaluation results for ${evaluationMetricKeys.join(', ')} metrics`,
          properties: this._buildKeyProperties(evaluationMetricKeys),
          required: evaluationMetricKeys,
          additionalProperties: false,
        },
      },
      required: ['evaluations'],
      additionalProperties: false,
    } as const;
  }

  private static _buildKeyProperties(evaluationMetricKeys: string[]) {
    return evaluationMetricKeys.reduce(
      (acc, key) => {
        acc[key] = this._buildKeySchema(key);
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  private static _buildKeySchema(key: string) {
    return {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: `Score between 0.0 and 1.0 for ${key}`,
        },
        reasoning: {
          type: 'string',
          description: `Reasoning behind the score for ${key}`,
        },
      },
      required: ['score', 'reasoning'],
      additionalProperties: false,
    };
  }
}

export { EvaluationSchemaBuilder };
