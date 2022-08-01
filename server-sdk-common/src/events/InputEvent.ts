import InputCustomEvent from './InputCustomEvent';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';

type InputEvent = InputEvalEvent | InputCustomEvent | InputIdentifyEvent;
export default InputEvent;
