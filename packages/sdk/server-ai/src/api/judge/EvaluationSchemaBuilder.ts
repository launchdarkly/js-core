/**
 * Internal class for building dynamic evaluation response schemas.
 * Not exported - only used internally by TrackedJudge.
 */
class EvaluationSchemaBuilder {
  static build(evaluationMetricKey?: string): Record<string, unknown> {
    if (!evaluationMetricKey) {
      return {};
    }
    return {
      type: 'object',
      properties: {
        evaluations: {
          type: 'object',
          description: `Object containing evaluation results for ${evaluationMetricKey} metric`,
          properties: {
            [evaluationMetricKey]: this._buildKeySchema(evaluationMetricKey),
          },
          required: [evaluationMetricKey],
          additionalProperties: false,
        },
      },
      required: ['evaluations'],
      additionalProperties: false,
    } as const;
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
