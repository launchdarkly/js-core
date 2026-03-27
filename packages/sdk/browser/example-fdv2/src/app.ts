// Temporary app for testing FDv2 functionality.
import { basicLogger, createClient, type LDClient } from '@launchdarkly/js-client-sdk';

// Set clientSideID to your LaunchDarkly client-side ID
const clientSideID = 'LD_CLIENT_SIDE_ID';

// Set flagKey to the feature flag key you want to evaluate
const flagKey = 'LD_FLAG_KEY';

const contexts = [
  { kind: 'user', key: 'user-1', name: 'Sandy' },
  { kind: 'user', key: 'user-2', name: 'Alex' },
  { kind: 'user', key: 'user-3', name: 'Jordan' },
  { kind: 'org', key: 'org-1', name: 'Acme Corp' },
];

let currentContextIndex = 0;
let eventHandlersRegistered = false;
let changeHandler: (() => void) | undefined;
let errorHandler: (() => void) | undefined;

function el(tag: string, attrs?: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  }
  return e;
}

function text(s: string): Text {
  return document.createTextNode(s);
}

function formatContext(ctx: (typeof contexts)[0]): string {
  return `${ctx.kind}:${ctx.key} (${ctx.name})`;
}

function buildUI() {
  const container = el('div', { id: 'app' });

  // Status
  const statusBox = el('div', { id: 'status' });
  statusBox.appendChild(text('Initializing...'));
  container.appendChild(statusBox);

  // Flag value
  const flagBox = el('div', { id: 'flag' });
  flagBox.appendChild(text('No flag evaluations yet'));
  container.appendChild(flagBox);

  // Controls
  const controls = el('div', { id: 'controls' });

  // Context switcher
  const ctxSection = el('div');
  ctxSection.appendChild(el('h3'));
  ctxSection.querySelector('h3')!.textContent = 'Context';
  const ctxLabel = el('span', { id: 'ctx-label' });
  ctxLabel.textContent = formatContext(contexts[0]);
  ctxSection.appendChild(ctxLabel);
  ctxSection.appendChild(text(' '));
  const ctxBtn = el('button', { id: 'btn-ctx' });
  ctxBtn.textContent = 'Switch Context';
  ctxSection.appendChild(ctxBtn);
  controls.appendChild(ctxSection);

  // Event handlers
  const evtSection = el('div');
  evtSection.appendChild(el('h3'));
  evtSection.querySelector('h3')!.textContent = 'Event Handlers';
  const evtStatus = el('span', { id: 'evt-status' });
  evtStatus.textContent = 'Not registered';
  evtSection.appendChild(evtStatus);
  evtSection.appendChild(text(' '));
  const evtBtn = el('button', { id: 'btn-evt' });
  evtBtn.textContent = 'Register';
  evtSection.appendChild(evtBtn);
  controls.appendChild(evtSection);

  // Streaming control
  const streamSection = el('div');
  streamSection.appendChild(el('h3'));
  streamSection.querySelector('h3')!.textContent = 'Streaming';
  const streamStatus = el('span', { id: 'stream-status' });
  streamStatus.textContent = 'undefined (automatic)';
  streamSection.appendChild(streamStatus);
  streamSection.appendChild(el('br'));
  const btnTrue = el('button', { id: 'btn-stream-true' });
  btnTrue.textContent = 'Force On';
  const btnFalse = el('button', { id: 'btn-stream-false' });
  btnFalse.textContent = 'Force Off';
  const btnUndef = el('button', { id: 'btn-stream-undef' });
  btnUndef.textContent = 'Automatic';
  streamSection.appendChild(btnTrue);
  streamSection.appendChild(text(' '));
  streamSection.appendChild(btnFalse);
  streamSection.appendChild(text(' '));
  streamSection.appendChild(btnUndef);
  controls.appendChild(streamSection);

  // Log
  const logSection = el('div');
  logSection.appendChild(el('h3'));
  logSection.querySelector('h3')!.textContent = 'Event Log';
  const logBox = el('div', { id: 'log' });
  logSection.appendChild(logBox);
  controls.appendChild(logSection);

  container.appendChild(controls);
  document.body.appendChild(container);
}

function log(msg: string) {
  const logBox = document.getElementById('log')!;
  const entry = el('div');
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${msg}`;
  logBox.insertBefore(entry, logBox.firstChild);
  // Keep last 50 entries
  while (logBox.children.length > 50) {
    logBox.removeChild(logBox.lastChild!);
  }
}

function renderFlag(client: LDClient) {
  const flagValue = client.variation(flagKey, false);
  const flagBox = document.getElementById('flag')!;
  flagBox.textContent = `${flagKey} = ${JSON.stringify(flagValue)}`;
  document.body.style.background = flagValue ? '#00844B' : '#373841';
}

function updateStatus(msg: string) {
  document.getElementById('status')!.textContent = msg;
}

function updateCtxLabel() {
  document.getElementById('ctx-label')!.textContent = formatContext(contexts[currentContextIndex]);
}

function updateEvtStatus() {
  const evtStatus = document.getElementById('evt-status')!;
  const btn = document.getElementById('btn-evt')!;
  if (eventHandlersRegistered) {
    evtStatus.textContent = 'Registered (change + error)';
    btn.textContent = 'Unregister';
  } else {
    evtStatus.textContent = 'Not registered';
    btn.textContent = 'Register';
  }
}

function updateStreamStatus(value: boolean | undefined) {
  const label = document.getElementById('stream-status')!;
  if (value === true) {
    label.textContent = 'true (forced on)';
  } else if (value === false) {
    label.textContent = 'false (forced off)';
  } else {
    label.textContent = 'undefined (automatic)';
  }
}

function registerHandlers(client: LDClient) {
  if (eventHandlersRegistered) return;

  changeHandler = () => {
    log('change event received');
    renderFlag(client);
  };
  errorHandler = () => {
    log('error event received');
  };

  client.on('change', changeHandler);
  client.on('error', errorHandler);
  eventHandlersRegistered = true;
  updateEvtStatus();
  log('Event handlers registered');
}

function unregisterHandlers(client: LDClient) {
  if (!eventHandlersRegistered) return;

  if (changeHandler) {
    client.off('change', changeHandler);
    changeHandler = undefined;
  }
  if (errorHandler) {
    client.off('error', errorHandler);
    errorHandler = undefined;
  }
  eventHandlersRegistered = false;
  updateEvtStatus();
  log('Event handlers unregistered');
}

const main = async () => {
  buildUI();

  const client = createClient(clientSideID, contexts[currentContextIndex], {
    // @ts-ignore dataSystem is @internal — experimental FDv2 opt-in
    dataSystem: {},
    logger: basicLogger({ level: 'debug' }),
  });

  // Context switching
  document.getElementById('btn-ctx')!.addEventListener('click', async () => {
    currentContextIndex = (currentContextIndex + 1) % contexts.length;
    const ctx = contexts[currentContextIndex];
    updateCtxLabel();
    log(`Identifying as ${formatContext(ctx)}...`);
    const result = await client.identify(ctx);
    log(`Identify result: ${result.status}`);
    renderFlag(client);
  });

  // Event handler toggle
  document.getElementById('btn-evt')!.addEventListener('click', () => {
    if (eventHandlersRegistered) {
      unregisterHandlers(client);
    } else {
      registerHandlers(client);
    }
  });

  // Streaming controls
  document.getElementById('btn-stream-true')!.addEventListener('click', () => {
    client.setStreaming(true);
    updateStreamStatus(true);
    log('setStreaming(true)');
  });
  document.getElementById('btn-stream-false')!.addEventListener('click', () => {
    client.setStreaming(false);
    updateStreamStatus(false);
    log('setStreaming(false)');
  });
  document.getElementById('btn-stream-undef')!.addEventListener('click', () => {
    client.setStreaming(undefined);
    updateStreamStatus(undefined);
    log('setStreaming(undefined)');
  });

  // Start
  client.start();
  const { status } = await client.waitForInitialization();
  updateStatus(`Initialized (${status}) - ${formatContext(contexts[currentContextIndex])}`);
  log(`Initialization: ${status}`);
  renderFlag(client);
};

main();
