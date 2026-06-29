import * as net from 'net';

export interface SocksProxyServer {
  hostname: string;
  port: number;
  requestCount: () => number;
  authFailures: () => { uname: string; passwd: string }[];
  close: () => void;
}

export interface SocksProxyServerOptions {
  username?: string;
  password?: string;
  // Address for the proxy itself to listen on. Defaults to 127.0.0.1; pass '::1' to exercise the
  // SDK's handling of an IPv6 literal proxy host.
  bindAddress?: string;
}

// A minimal SOCKS5 proxy server for tests. It implements just enough of RFC 1928 (and the
// username/password auth method from RFC 1929) to let the SDK's SOCKS support be exercised
// end-to-end: it negotiates a method, optionally checks credentials, handles a CONNECT command,
// and then pipes bytes between the client and the real target server.
export function startSocksProxyServer(
  options: SocksProxyServerOptions = {},
): Promise<SocksProxyServer> {
  const expectedUser = options.username;
  const expectedPassword = options.password;
  const requireAuth = !!expectedUser;
  const bindAddress = options.bindAddress ?? '127.0.0.1';

  let connectionCount = 0;
  const authFailures: { uname: string; passwd: string }[] = [];

  const server = net.createServer((clientSocket) => {
    function handleConnect(request: Buffer) {
      // VER(1) CMD(1) RSV(1) ATYP(1) DST.ADDR DST.PORT(2)
      const atyp = request[3];
      let host: string;
      let portOffset: number;
      if (atyp === 0x01) {
        host = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
        portOffset = 8;
      } else if (atyp === 0x03) {
        const len = request[4];
        host = request.slice(5, 5 + len).toString();
        portOffset = 5 + len;
      } else if (atyp === 0x04) {
        // IPv6: 16 bytes formatted as eight colon-separated hextets. The SOCKS client resolves
        // hostnames such as "localhost" itself, and on many systems that yields ::1, so we have
        // to handle this address type as well as IPv4.
        const groups: string[] = [];
        for (let i = 0; i < 8; i += 1) {
          groups.push(request.readUInt16BE(4 + i * 2).toString(16));
        }
        host = groups.join(':');
        portOffset = 4 + 16;
      } else {
        // Unsupported address type
        clientSocket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        clientSocket.end();
        return;
      }
      const port = request.readUInt16BE(portOffset);

      const targetSocket = net.connect(port, host, () => {
        connectionCount += 1;
        // Success reply with a dummy bound address/port (0.0.0.0:0)
        clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
      });
      targetSocket.on('error', () => {
        clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        clientSocket.end();
      });
    }

    clientSocket.once('data', () => {
      // greeting: VER(1) NMETHODS(1) METHODS(NMETHODS)
      const chosenMethod = requireAuth ? 0x02 : 0x00;
      clientSocket.write(Buffer.from([0x05, chosenMethod]));

      const afterAuth = () => clientSocket.once('data', handleConnect);

      if (requireAuth) {
        clientSocket.once('data', (authData) => {
          // VER(1) ULEN(1) UNAME PLEN(1) PASSWD
          const ulen = authData[1];
          const uname = authData.slice(2, 2 + ulen).toString();
          const plen = authData[2 + ulen];
          const passwd = authData.slice(3 + ulen, 3 + ulen + plen).toString();
          const ok = uname === expectedUser && passwd === expectedPassword;
          if (!ok) {
            authFailures.push({ uname, passwd });
          }
          clientSocket.write(Buffer.from([0x01, ok ? 0x00 : 0x01]));
          if (ok) {
            afterAuth();
          } else {
            clientSocket.end();
          }
        });
      } else {
        afterAuth();
      }
    });

    clientSocket.on('error', () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, bindAddress, () => {
      const address = server.address() as net.AddressInfo;
      resolve({
        hostname: bindAddress,
        port: address.port,
        requestCount: () => connectionCount,
        authFailures: () => authFailures,
        close: () => server.close(),
      });
    });
  });
}
