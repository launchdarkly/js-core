/**
 * Ripped from:
 * https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Events/CustomEvent.js#L21
 */
import { Event } from 'event-target-shim';

type CustomEventOptions = {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
  detail?: any;
};

export default class CustomEvent extends Event {
  detail: any;

  constructor(typeArg: string, options: CustomEventOptions) {
    const { bubbles, cancelable, composed, detail } = options;
    super(typeArg, { bubbles, cancelable, composed });

    this.detail = detail; // this would correspond to `NativeEvent` in SyntheticEvent
  }
}
