import RollingBuffer from '../src/collectors/rrweb/RollingBuffer';

it('can fill the entire expected buffer size', () => {
  const bufferSize = 5;
  const numberBuffers = 4;
  const buffer = new RollingBuffer(bufferSize, numberBuffers);
  const demoItems = Array.from(new Array(bufferSize * numberBuffers), (_, i) => i);

  demoItems.forEach(buffer.push.bind(buffer));

  expect(buffer.toArray()).toEqual(demoItems);
});

it('when the buffer is exceeded it will wrap around', () => {
  const bufferSize = 5;
  const numberBuffers = 4;
  const buffer = new RollingBuffer(bufferSize, numberBuffers);
  const dropRatio = 1.5;
  const extraItems = Math.trunc(bufferSize * dropRatio);
  const itemsToMake = bufferSize * numberBuffers + extraItems;
  const demoItems = Array.from(new Array(itemsToMake), (_, i) => i);

  demoItems.forEach(buffer.push.bind(buffer));

  // We need to remove the number of chunks, not the specific number of items.
  const expectedItems = demoItems.slice(Math.ceil(dropRatio) * bufferSize);

  expect(buffer.toArray()).toEqual(expectedItems);
});
