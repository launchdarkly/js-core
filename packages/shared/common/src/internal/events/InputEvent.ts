import InputCustomEvent from './InputCustomEvent';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';
import InputMigrationEvent from './InputMigrationEvent';

type InputEvent = InputEvalEvent | InputCustomEvent | InputIdentifyEvent | InputMigrationEvent;
export default InputEvent;
