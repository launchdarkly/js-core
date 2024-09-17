import Context from '../../Context';

export default interface InputIdentifyEvent {
  kind: 'click';
  samplingRatio: number;
  key: string;
  url: string;
  creationDate: number;
  context: Context;
  selector: string;
}
