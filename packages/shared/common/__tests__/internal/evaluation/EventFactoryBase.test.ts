import Context from '../../../src/Context';
import EventFactoryBase from '../../../src/internal/evaluation/EventFactoryBase';

const context = Context.fromLDContext({ key: 'user-key' });

function evalEvent(factory: EventFactoryBase, overrideAffected?: boolean) {
  return factory.evalEvent({
    context,
    defaultVal: 'default',
    flagKey: 'flag',
    trackEvents: true,
    value: 'value',
    variation: 1,
    version: 3,
    reason: { kind: 'FALLTHROUGH' },
    overrideAffected,
  });
}

it('carries the override marking on the evaluation event', () => {
  const event = evalEvent(new EventFactoryBase(true), true);
  expect(event.overrideAffected).toBe(true);
  expect(event.key).toEqual('flag');
  expect(event.trackEvents).toBe(true);
});

it('omits the marking when the evaluation was not affected', () => {
  expect(evalEvent(new EventFactoryBase(true), false).overrideAffected).toBe(false);
  expect(evalEvent(new EventFactoryBase(true))).not.toHaveProperty('overrideAffected');
});

it('does not mark an unknown flag event', () => {
  const event = new EventFactoryBase(false).unknownFlagEvent('flag', 'default', context);
  expect(event).not.toHaveProperty('overrideAffected');
});
