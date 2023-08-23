import Context from '../../Context';

export default class InputCustomEvent {
  public readonly kind = 'custom';

  public readonly creationDate: number;

  constructor(
    public readonly context: Context,
    public readonly key: string,
    public readonly data?: any,
    public readonly metricValue?: number,
    public readonly samplingRatio: number = 1,
    public readonly indexSamplingRatio: number = 1,
  ) {
    this.creationDate = Date.now();
    this.context = context;
  }
}
