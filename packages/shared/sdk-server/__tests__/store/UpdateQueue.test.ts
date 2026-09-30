import UpdateQueue from '../../src/store/UpdateQueue';

it('forwards an error from the update function to the original callback', (done) => {
  const queue = new UpdateQueue();
  queue.enqueue(
    (cb) => cb(new Error('bad')),
    (err) => {
      expect(err).toEqual(new Error('bad'));
      done();
    },
  );
});

it('forwards no error when the update function succeeds', (done) => {
  const queue = new UpdateQueue();
  queue.enqueue(
    (cb) => cb(),
    (err) => {
      expect(err).toBeUndefined();
      done();
    },
  );
});
