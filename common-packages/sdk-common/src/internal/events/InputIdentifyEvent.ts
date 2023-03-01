import Context from '../../Context';

export default class InputIdentifyEvent {
  public readonly kind = 'identify';

  public readonly creationDate: number;

  public readonly context: Context;

  constructor(context: Context) {
    this.creationDate = Date.now();
    this.context = context;
  }
}
