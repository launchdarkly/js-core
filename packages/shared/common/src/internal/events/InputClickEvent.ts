import Context from '../../Context';

export default interface InputClickEvent {
  kind: 'click';
  samplingRatio: number;
  key: string;
  url: string;
  creationDate: number;
  context: Context;
  selector: string;
}
