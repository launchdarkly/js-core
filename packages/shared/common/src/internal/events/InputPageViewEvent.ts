import Context from '../../Context';

export default interface InputPageViewEvent {
  kind: 'pageview';
  samplingRatio: number;
  key: string;
  url: string;
  creationDate: number;
  context: Context;
}
