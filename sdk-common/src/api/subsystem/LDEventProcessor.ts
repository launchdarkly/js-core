import { InputEvent } from '../../internal';

export default interface LDEventProcessor {
  close(): void;
  flush(): Promise<void>;
  sendEvent(inputEvent: InputEvent): void;
}
