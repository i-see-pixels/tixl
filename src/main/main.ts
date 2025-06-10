/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import fs from 'fs/promises'; // For file system operations

// Define the path for your data file
const USER_DATA_PATH = app.getPath('userData');
const TODOS_FILE_PATH = path.join(USER_DATA_PATH, 'todos.json');

const TITLE_BAR_HEIGHT_PX = 30; // Matches your CSS .titleBar height
let currentExpandedHeight = 450; // Default height when expanded (matches initial window height)
let mainWindow: BrowserWindow | null = null;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// --- IPC Handlers for Window Controls (since it's frameless) ---
// ipcMain.on('minimize', () => {
//   mainWindow?.minimize();
// });
ipcMain.on('maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('close', () => {
  mainWindow?.close();
});

ipcMain.on('toggle-collapse', () => {
  if (mainWindow) {
    const [width, height] = mainWindow.getSize();

    if (height > TITLE_BAR_HEIGHT_PX) {
      // If currently expanded, store current height and collapse
      currentExpandedHeight = height; // Save current height before collapsing
      mainWindow.setSize(width, TITLE_BAR_HEIGHT_PX, true); // true for smooth animation
    } else {
      // If currently collapsed, restore to stored expanded height
      mainWindow.setSize(width, currentExpandedHeight, true); // true for smooth animation
    }
  }
});

// --- IPC Handlers for Data Persistence ---
ipcMain.handle('load-todos', async () => {
  try {
    log.info('Loading todos from file:', TODOS_FILE_PATH);
    const data = await fs.readFile(TODOS_FILE_PATH, { encoding: 'utf-8' });
    // IMPORTANT: Handle empty file or non-JSON content
    if (!data.trim()) {
      // If file is empty or just whitespace
      log.info('Todos file is empty, returning empty array.');
      return [];
    }
    const parsedData = JSON.parse(data);

    // IMPORTANT: Ensure parsed data is an array
    if (!Array.isArray(parsedData)) {
      log.warn(
        `Todos file contains non-array data: ${data}. Returning empty array.`,
      );
      return [];
    }

    return parsedData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      log.info('Todos file not found, returning empty array.');
      return [];
    }
    log.error('Failed to load or parse todos file:', error);
    throw error;
  }
});

ipcMain.handle('save-todos', async (event, todos) => {
  try {
    // Ensure the directory exists before writing
    await fs.mkdir(path.dirname(TODOS_FILE_PATH), { recursive: true });
    await fs.writeFile(TODOS_FILE_PATH, JSON.stringify(todos, null, 2), {
      encoding: 'utf-8',
    });
    log.info('Todos saved successfully.');
  } catch (error) {
    log.error('Failed to save todos:', error);
    throw error;
  }
});

// --- IPC Handler for setting alwaysOnTop status (optional toggle) ---
ipcMain.on('set-always-on-top', (event, status: boolean) => {
  mainWindow?.setAlwaysOnTop(status, 'normal');
  log.info(`Always On Top set to: ${status}`);
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const screenPadding = 60; // Padding from the right edge of the screen
  const windowWidth = 300; // Width of the window
  const windowHeight = 300; // Height of the window

  mainWindow = new BrowserWindow({
    frame: false,
    alwaysOnTop: true,
    titleBarStyle: 'hidden',
    transparent: true,
    show: false,
    width: windowWidth,
    height: windowHeight,
    roundedCorners: true,
    x: screenWidth - (windowWidth + screenPadding),
    y: screenPadding,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
      currentExpandedHeight = mainWindow.getSize()[1];
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMinimized()) {
      // Only update if not minimized and not currently collapsed (i.e., user is truly resizing the content area)
      const currentHeight = mainWindow.getSize()[1];
      if (currentHeight > TITLE_BAR_HEIGHT_PX + 5) {
        // Add a small buffer to avoid misinterpreting title bar height as a resize
        currentExpandedHeight = currentHeight;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
