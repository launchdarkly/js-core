import { createParser, EventSourceMessage, EventSourceParser, ParseError } from '../../src/parser';

interface RecordingParser {
  parser: EventSourceParser;
  events: EventSourceMessage[];
  ids: string[];
  retries: number[];
  comments: string[];
  errors: ParseError[];
}

function recordingParser(): RecordingParser {
  const events: EventSourceMessage[] = [];
  const ids: string[] = [];
  const retries: number[] = [];
  const comments: string[] = [];
  const errors: ParseError[] = [];
  const parser = createParser({
    onEvent: (event) => events.push(event),
    onId: (id) => ids.push(id),
    onRetry: (retry) => retries.push(retry),
    onComment: (comment) => comments.push(comment),
    onError: (error) => errors.push(error),
  });
  return { parser, events, ids, retries, comments, errors };
}

it('parses a single-line event', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: hello\n\n');
  expect(events).toHaveLength(1);
  expect(events[0].data).toEqual('hello');
  expect(events[0].event).toBeUndefined();
});

it('parses two events from one chunk', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: a\n\ndata: b\n\n');
  expect(events.map((e) => e.data)).toEqual(['a', 'b']);
});

it('accepts CRLF as the line terminator', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: hello\r\n\r\n');
  expect(events.map((e) => e.data)).toEqual(['hello']);
});

it('accepts a bare CR as the line terminator', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: hello\r\r');
  expect(events.map((e) => e.data)).toEqual(['hello']);
});

it('treats a CRLF split across two feeds as one terminator', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: hello\r');
  parser.feed('\n\r\n');
  expect(events.map((e) => e.data)).toEqual(['hello']);
});

it('parses a line terminated by a CR at a chunk boundary when the next chunk is not a line feed', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: a\r');
  parser.feed('data: b\r\r');
  expect(events.map((e) => e.data)).toEqual(['a\nb']);
});

it('strips a leading byte order mark', () => {
  const { parser, events } = recordingParser();
  parser.feed('\uFEFFdata: x\n\n');
  expect(events.map((e) => e.data)).toEqual(['x']);
});

it('strips a raw byte order mark split across feeds', () => {
  const { parser, events } = recordingParser();
  // The three UTF-8 BOM bytes arrive as separate byte-valued code points across chunks.
  parser.feed('\xEF');
  parser.feed('\xBB\xBF');
  parser.feed('data: x\n\n');
  expect(events.map((e) => e.data)).toEqual(['x']);
});

it('does not strip a byte order mark after the start of the stream', () => {
  const { parser, events, errors } = recordingParser();
  parser.feed('data: x\n\uFEFFdata: y\n\n');
  expect(events.map((e) => e.data)).toEqual(['x']);
  expect(errors).toHaveLength(1);
  expect(errors[0].type).toEqual('unknown-field');
});

it('joins multi-line data with newlines', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: one\ndata:two\n\n');
  expect(events.map((e) => e.data)).toEqual(['one\ntwo']);
});

it('reports the id before the event when a block has both', () => {
  const order: string[] = [];
  const parser = createParser({
    onId: (id) => order.push(`id:${id}`),
    onEvent: (event) => order.push(`event:${event.data}`),
  });
  parser.feed('id: 1\ndata: x\n\n');
  expect(order).toEqual(['id:1', 'event:x']);
});

it('reports an id for a block that has no data', () => {
  const { parser, events, ids } = recordingParser();
  parser.feed('id: 5\n\n');
  expect(ids).toEqual(['5']);
  expect(events).toHaveLength(0);
});

it('ignores an id that contains a null character', () => {
  const { parser, events, ids } = recordingParser();
  parser.feed('id: a\u0000b\ndata: x\n\n');
  expect(ids).toEqual([]);
  expect(events.map((e) => e.data)).toEqual(['x']);
});

it('reports an empty id field as an empty string', () => {
  const { parser, ids } = recordingParser();
  parser.feed('id:\ndata: x\n\n');
  expect(ids).toEqual(['']);
});

it('forwards an all-digit retry value', () => {
  const { parser, retries } = recordingParser();
  parser.feed('retry: 2500\n\n');
  expect(retries).toEqual([2500]);
});

it('caps a retry value above one hour at one hour', () => {
  const { parser, retries } = recordingParser();
  parser.feed('retry: 3600001\n\n');
  expect(retries).toEqual([3600000]);
});

it('caps an overlong retry value that parses to Infinity at one hour', () => {
  const { parser, retries } = recordingParser();
  parser.feed(`retry: ${'9'.repeat(400)}\n\n`);
  expect(retries).toEqual([3600000]);
});

it('reports a retry value that is not all digits through onError and does not forward it', () => {
  const { parser, retries, errors } = recordingParser();
  parser.feed('retry: 12abc\n\n');
  expect(retries).toEqual([]);
  expect(errors).toHaveLength(1);
  expect(errors[0].type).toEqual('invalid-retry');
});

it('treats a field name without a colon as a field with an empty value', () => {
  const { parser, events } = recordingParser();
  parser.feed('data\n\n');
  expect(events.map((e) => e.data)).toEqual(['']);
});

it('reports comment lines through onComment', () => {
  const { parser, events, comments } = recordingParser();
  parser.feed(': keep-alive\n\n:x\n\n');
  expect(comments).toEqual(['keep-alive', 'x']);
  expect(events).toHaveLength(0);
});

it('reports an unknown field through onError and dispatches nothing', () => {
  const { parser, events, errors } = recordingParser();
  parser.feed('foo: bar\n\n');
  expect(events).toHaveLength(0);
  expect(errors).toHaveLength(1);
  expect(errors[0].type).toEqual('unknown-field');
  expect(errors[0].field).toEqual('foo');
});

it('leaves the event type undefined when the event field is empty', () => {
  const { parser, events } = recordingParser();
  parser.feed('event:\ndata: x\n\n');
  expect(events).toHaveLength(1);
  expect(events[0].event).toBeUndefined();
});

it('carries an explicit event type on the parsed event', () => {
  const { parser, events } = recordingParser();
  parser.feed('event: greeting\ndata: hi\n\n');
  expect(events[0].event).toEqual('greeting');
  expect(events[0].data).toEqual('hi');
});

it('buffers a field split across many small feeds', () => {
  const { parser, events } = recordingParser();
  parser.feed('da');
  parser.feed('ta: Hel');
  parser.feed('lo\n\n');
  expect(events.map((e) => e.data)).toEqual(['Hello']);
});

it('discards a line that cannot become a field and resumes at the next line', () => {
  const { parser, events } = recordingParser();
  parser.feed('xyzzy');
  parser.feed('zzz\ndata: x\n\n');
  expect(events.map((e) => e.data)).toEqual(['x']);
});

it('drops a buffered partial line on reset', () => {
  const { parser, events } = recordingParser();
  parser.feed('data: par');
  parser.reset();
  parser.feed('data: x\n\n');
  expect(events.map((e) => e.data)).toEqual(['x']);
});

it('consumes a pending partial line when reset is told to consume', () => {
  const { parser, retries } = recordingParser();
  parser.feed('retry: 99');
  parser.reset({ consume: true });
  expect(retries).toEqual([99]);
});
