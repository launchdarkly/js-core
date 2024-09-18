import Context from '../../Context';

export default class InputCustomEvent {
  public readonly kind = 'custom';

  public readonly creationDate: number;

  constructor(
    public readonly context: Context,
    public readonly key: string,
    public readonly data?: any,
    public readonly metricValue?: number,
    // Currently custom events are not sampled, but this is here to make the handling
    // code more uniform.
    public readonly samplingRatio: number = 1,
    // Browser SDKs can include a URL for custom events.
    public readonly url?: string,
  ) {
    this.creationDate = Date.now();
    this.context = context;
  }
}
