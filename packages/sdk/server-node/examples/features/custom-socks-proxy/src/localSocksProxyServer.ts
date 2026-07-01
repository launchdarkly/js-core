import * as net from 'net';

export interface LocalSocksProxyServer {
  port: number;
  connectionCount: () => number;
  close: () => void;
}

// A minimal unauthenticated SOCKS5 proxy, implementing just enough of RFC 1928 to relay the
// CONNECT requests this example's SocksProxyAgent will issue. It exists so the example runs
// out of the box without any external proxy infrastructure; point SOCKS_PROXY_URL at a real
// SOCKS proxy (see README.md) to bypass this and exercise a real one instead.
export function startLocalSocksProxyServer(): Promise<LocalSocksProxyServer> {
  let connectionCount = 0;

  const server = net.createServer((clientSocket) => {
    function handleConnect(request: Buffer) {
      // VER(1) CMD(1) RSV(1) ATYP(1) DST.ADDR DST.PORT(2)
      const atyp = request.readUInt8(3);
      let host: string;
      let portOffset: number;
      if (atyp === 0x01) {
        host = [4, 5, 6, 7].map((i) => request.readUInt8(i)).join('.');
        portOffset = 8;
      } else if (atyp === 0x03) {
        const len = request.readUInt8(4);
        host = request.subarray(5, 5 + len).toString();
        portOffset = 5 + len;
      } else if (atyp === 0x04) {
        const groups: string[] = [];
        for (let i = 0; i < 8; i += 1) {
          groups.push(request.readUInt16BE(4 + i * 2).toString(16));
        }
        host = groups.join(':');
        portOffset = 4 + 16;
      } else {
        clientSocket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        clientSocket.end();
        return;
      }
      const port = request.readUInt16BE(portOffset);

      const targetSocket = net.connect(port, host, () => {
        connectionCount += 1;
        // Success reply with a dummy bound address/port (0.0.0.0:0).
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
      // Greeting: VER(1) NMETHODS(1) METHODS(NMETHODS). Always select "no authentication".
      clientSocket.write(Buffer.from([0x05, 0x00]));
      clientSocket.once('data', handleConnect);
    });

    clientSocket.on('error', () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      resolve({
        port: address.port,
        connectionCount: () => connectionCount,
        close: () => server.close(),
      });
    });
  });
}
