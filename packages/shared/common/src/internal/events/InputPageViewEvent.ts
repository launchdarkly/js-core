import Context from '../../Context';

export default interface InputIdentifyEvent {
  kind: 'pageview';
  samplingRatio: number;
  key: string;
  url: string;
  creationDate: number;
  context: Context;
}
