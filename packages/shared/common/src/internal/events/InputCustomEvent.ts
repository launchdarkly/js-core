import Context from '../../Context';

export default class InputCustomEvent {
  public readonly kind = 'custom';

  public readonly creationDate: number;

  public readonly context: Context;

  constructor(
    context: Context,
    public readonly key: string,
    public readonly data?: any,
    public readonly metricValue?: number,
  ) {
    this.creationDate = Date.now();
    this.context = context;
  }
}
