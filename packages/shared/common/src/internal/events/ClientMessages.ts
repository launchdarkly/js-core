/**
 * Messages for issues which can be encountered processing client requests.
 */
export default class ClientMessages {
  static readonly MissingContextKeyNoEvent =
    'Context was unspecified or had no key; event will not be sent';

  static invalidMetricValue(badType: string) {
    return (
      'The track function was called with a non-numeric "metricValue"' +
      ` (${badType}), only numeric metric values are supported.`
    );
  }
}
