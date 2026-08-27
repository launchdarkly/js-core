import { shouldReceiveMessages, withEventSource, withServer, writeEvents } from './helpers';

import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { MessageEvent } from '../src/types';

// Escapes are used for the non-ASCII test data so the file stays ASCII-only.
const euroAndTofu = '\u20ac\u8c46\u8151'; // "euro sign" + "tofu" in Chinese
const chineseSentence = '\u6211\u73fe\u5728\u90fd\u770b\u5be6\u6cc1\u4e0d\u73a9\u904a\u6232';
const oSlash = '\u00f8';

it('parses multibyte characters', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([`id: 1\ndata: ${euroAndTofu}\n\n`]));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: euroAndTofu }]);
    });
  });
});

it('parses empty lines with multibyte characters', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([`\n\n\n\nid: 1\ndata: ${chineseSentence}\n\n`]));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: chineseSentence }]);
    });
  });
});

it('parses one one-line message in one chunk', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hello\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }]);
    });
  });
});

it('ignores byte-order mark', async () => {
  await withServer(async (server) => {
    server.byDefault((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(String.fromCharCode(0xfeff));
      res.write('data: foo\n\n');
      res.end();
    });
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'foo' }]);
    });
  });
});

it('parses one one-line message in two chunks', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hel', 'lo\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }]);
    });
  });
});

it('parses two one-line messages in one chunk', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hello\n\n', 'data: World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }, { data: 'World' }]);
    });
  });
});

it('parses one two-line message in one chunk', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hello\ndata:World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello\nWorld' }]);
    });
  });
});

it('parses chopped up unicode data', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(`data: Aslak\n\ndata: Helles${oSlash}y\n\n`.split('')));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Aslak' }, { data: `Helles${oSlash}y` }]);
    });
  });
});

it('parses really chopped up unicode data', async () => {
  const content = `Aslak Helles${oSlash}y is the original author`;
  await withServer(async (server) => {
    server.byDefault((req, res) => {
      const msg = Buffer.from(`data: ${content}\n\n`);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      // Slice in the middle of the two-byte UTF-8 sequence for the o-slash, making sure that one
      // data chunk contains the first byte and the second chunk gets the other.
      res.write(msg.subarray(0, 19), 'binary', () => {
        res.write(msg.subarray(19));
      });
    });
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: content }]);
    });
  });
});

it('accepts CRLF as separator', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(`data: Aslak\r\n\r\ndata: Helles${oSlash}y\r\n\r\n`.split('')));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Aslak' }, { data: `Helles${oSlash}y` }]);
    });
  });
});

it('accepts CR as separator', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(`data: Aslak\r\rdata: Helles${oSlash}y\r\r`.split('')));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Aslak' }, { data: `Helles${oSlash}y` }]);
    });
  });
});

it('ignores comments', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hello\n\n:nothing to see here\n\ndata: World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }, { data: 'World' }]);
    });
  });
});

it('ignores empty comments', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hello\n\n:\n\ndata: World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }, { data: 'World' }]);
    });
  });
});

it('does not ignore multiline strings', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: line one\ndata:\ndata: line two\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'line one\n\nline two' }]);
    });
  });
});

it('does not ignore multiline strings even in data beginning', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data:\ndata:line one\ndata: line two\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: '\nline one\nline two' }]);
    });
  });
});

it('treats field name without colon as a field with an empty value', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data\n\ndata\ndata\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: '' }, { data: '\n' }]);
    });
  });
});

it('causes entire event to be ignored for empty event field', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['event:\n\ndata: Hello\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const emitted = new AsyncQueue<string>();
      const originalEmit = es.emit.bind(es);
      es.emit = (event: string | symbol, ...args: any[]): boolean => {
        emitted.add(String(event));
        return originalEmit(event, ...args);
      };
      await shouldReceiveMessages(es, [{ data: 'Hello' }]);
      while (!emitted.isEmpty()) {
        // eslint-disable-next-line no-await-in-loop
        const e = await emitted.take();
        expect(['open', 'message', 'closed']).toContain(e);
      }
    });
  });
});

it(
  'parses relatively huge messages efficiently',
  async () => {
    await withServer(async (server) => {
      const longMessageContent = new Array(100000).join('a');
      server.byDefault(writeEvents([`data: ${longMessageContent}\n\n`]));
      await withEventSource(server.url, undefined, async (es) => {
        await shouldReceiveMessages(es, [{ data: longMessageContent }]);
      });
    });
  },
  1000,
);

it(
  'parses a relatively huge message across many chunks efficiently',
  async () => {
    await withServer(async (server) => {
      const longMessageContent = new Array(100000).join('a');
      const longMessage = `data: ${longMessageContent}\n\n`;
      // Split the message into chunks of 10 characters.
      const longMessageChunks = longMessage.match(/[\s\S]{1,10}/g) as string[];
      server.byDefault(writeEvents(longMessageChunks));
      await withEventSource(server.url, undefined, async (es) => {
        await shouldReceiveMessages(es, [{ data: longMessageContent }]);
      });
    });
  },
  1000,
);

it('parses two messages spanning 3 chunks with a shared chunk', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: Hel', 'lo\n\ndata:', 'World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'Hello' }, { data: 'World' }]);
    });
  });
});

it('delivers a message with an explicit event type', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['event: greeting\ndata: Hello\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = new AsyncQueue<MessageEvent>();
      es.addEventListener('greeting', (m) => messages.add(m));
      const m = await messages.take();
      expect(m.data).toEqual('Hello');
    });
  });
});
