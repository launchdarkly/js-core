// eslint-disable-next-line import/no-extraneous-dependencies
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'node:path';

import { createClient } from '@launchdarkly/electron-client-sdk';
import type { LDContextStrict, LDOptions } from '@launchdarkly/electron-client-sdk';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let launchDarklyMainProcessClient;
const launchDarklyMobileKey = process.env.LD_MOBILE_KEY ?? 'example-mobile-key';

const launchDarklyUser = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const launchDarklyOptions: LDOptions = {};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Create and start the LaunchDarkly client in the main process. The client is not ready until start() is called.
  launchDarklyMainProcessClient = createClient(
    launchDarklyMobileKey,
    launchDarklyUser,
    launchDarklyOptions,
  );
  await launchDarklyMainProcessClient.start();

  launchDarklyMainProcessClient.on(
    'change',
    (context: LDContextStrict, changedFlagKeys: string[]) => {
      // eslint-disable-next-line no-console
      console.log('change event received');
      // eslint-disable-next-line no-console
      console.log('context', context);
      // eslint-disable-next-line no-console
      console.log('changedFlagKeys', changedFlagKeys);
    },
  );

  launchDarklyMainProcessClient.on('error', (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('error event received', error);
  });

  launchDarklyMainProcessClient.on('ready', () => {
    // eslint-disable-next-line no-console
    console.log('ready event received');
  });

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
