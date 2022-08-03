/**
 * Messages for issues which can be encountered processing client requests.
 *
 * @internal
 */
export default class ClientMessages {
  static readonly missingContextKeyNoEvent = 'Context was unspecified or had no key; event will not be sent';
}
