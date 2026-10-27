const cp = require('child_process');

// Starts a long-running server process, waits until the URL responds, and returns a stop function.
async function startServer(cmd, args, { cwd, env, url, timeoutMs = 120000 }) {
  const child = cp.spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // already exited
    }
  };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      return { stop, log: () => log };
    } catch {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  stop();
  return { stop, log: () => log, failed: true };
}

// A request passes when the response is JSON reporting the flag evaluated to true.
async function check(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    try {
      const body = JSON.parse(text);
      return { ok: res.status === 200 && body.value === true, detail: text };
    } catch {
      return { ok: false, detail: `${res.status} ${text.slice(0, 500)}` };
    }
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

module.exports = { startServer, check };
