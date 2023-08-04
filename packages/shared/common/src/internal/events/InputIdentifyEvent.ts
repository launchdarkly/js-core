import Context from '../../Context';

export default class InputIdentifyEvent {
  public readonly kind = 'identify';

  public readonly creationDate: number;

  constructor(public readonly context: Context, public readonly samplingRatio: number = 1) {
    this.creationDate = Date.now();
  }
}
