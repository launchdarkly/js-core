import InputClickEvent from './InputClickEvent';
import InputCustomEvent from './InputCustomEvent';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';
import InputMigrationEvent from './InputMigrationEvent';
import InputPageViewEvent from './InputPageViewEvent';

type InputEvent =
  | InputEvalEvent
  | InputCustomEvent
  | InputIdentifyEvent
  | InputMigrationEvent
  | InputClickEvent
  | InputPageViewEvent;
export default InputEvent;
