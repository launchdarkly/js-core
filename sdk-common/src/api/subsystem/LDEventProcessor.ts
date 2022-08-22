import InputEvent from '../../internal/events/InputEvent';

export default interface LDEventProcessor {
  close(): void;
  flush(): Promise<void>;
  sendEvent(inputEvent: InputEvent): void;
}
