/**
 * Internal class for building evaluation response schemas.
 * Not exported - only used internally by Judge.
 *
 * The schema is a fixed shape: top-level score and reasoning.
 * The judge config's evaluationMetricKey is only used when keying the result,
 * not in the schema itself.
 */
class EvaluationSchemaBuilder {
  static build(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Score between 0.0 and 1.0.',
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning behind the score.',
        },
      },
      required: ['score', 'reasoning'],
      additionalProperties: false,
    };
  }
}

export { EvaluationSchemaBuilder };
