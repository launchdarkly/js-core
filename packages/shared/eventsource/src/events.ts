/**
 * W3C-style Event.
 *
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 */
export class ESEvent {
  readonly type!: string;

  constructor(type: string, optionalProperties?: Record<string, unknown>) {
    Object.defineProperty(this, 'type', { writable: false, value: type, enumerable: true });
    if (optionalProperties) {
      Object.keys(optionalProperties).forEach((f) => {
        Object.defineProperty(this, f, {
          writable: false,
          value: optionalProperties[f],
          enumerable: true,
        });
      });
    }
  }
}

/**
 * W3C-style MessageEvent.
 *
 * @see http://www.w3.org/TR/webmessaging/#event-definitions
 */
export class ESMessageEvent {
  readonly type!: string;

  readonly data!: string;

  readonly lastEventId!: string;

  readonly origin!: string;

  constructor(
    type: string,
    eventInitDict: { data: string; lastEventId: string; origin: string },
  ) {
    Object.defineProperty(this, 'type', { writable: false, value: type, enumerable: true });
    Object.keys(eventInitDict).forEach((f) => {
      Object.defineProperty(this, f, {
        writable: false,
        value: eventInitDict[f as keyof typeof eventInitDict],
        enumerable: true,
      });
    });
  }
}
