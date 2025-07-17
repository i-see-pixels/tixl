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
const WINDOW_STATE_FILE_PATH = path.join(USER_DATA_PATH, 'window-state.json');

const TITLE_BAR_HEIGHT_PX = 30; // Matches your CSS .titleBar height
let currentExpandedHeight = 300; // Default height when expanded (matches initial window height)
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
    
    // Add some tolerance for height comparison to handle potential rounding issues
    const isCurrentlyExpanded = height > TITLE_BAR_HEIGHT_PX + 10;
    
    if (isCurrentlyExpanded) {
      // If currently expanded, store current height and collapse
      currentExpandedHeight = height; // Save current height before collapsing
      log.info(`Collapsing window from height ${height} to ${TITLE_BAR_HEIGHT_PX}`);
      mainWindow.setSize(width, TITLE_BAR_HEIGHT_PX, true); // true for smooth animation
    } else {
      // If currently collapsed, restore to stored expanded height
      // Ensure we have a reasonable expanded height
      const targetHeight = Math.max(currentExpandedHeight, 300);
      log.info(`Expanding window from height ${height} to ${targetHeight}`);
      mainWindow.setSize(width, targetHeight, true); // true for smooth animation
    }
    
    // Save window state after toggle
    setTimeout(() => saveWindowState(), 100); // Small delay to ensure resize is complete
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

// --- Window State Management ---
const saveWindowState = async () => {
  if (!mainWindow) return;
  
  try {
    const [width, height] = mainWindow.getSize();
    const [x, y] = mainWindow.getPosition();
    const isMaximized = mainWindow.isMaximized();
    
    const windowState = {
      width,
      height,
      x,
      y,
      isMaximized,
      currentExpandedHeight,
    };
    
    await fs.mkdir(path.dirname(WINDOW_STATE_FILE_PATH), { recursive: true });
    await fs.writeFile(WINDOW_STATE_FILE_PATH, JSON.stringify(windowState, null, 2), {
      encoding: 'utf-8',
    });
    log.info('Window state saved successfully.');
  } catch (error) {
    log.error('Failed to save window state:', error);
  }
};

const loadWindowState = async () => {
  try {
    const data = await fs.readFile(WINDOW_STATE_FILE_PATH, { encoding: 'utf-8' });
    if (!data.trim()) {
      log.info('Window state file is empty, using defaults.');
      return null;
    }
    
    const windowState = JSON.parse(data);
    log.info('Window state loaded successfully.');
    return windowState;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      log.info('Window state file not found, using defaults.');
      return null;
    }
    log.error('Failed to load window state:', error);
    return null;
  }
};

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
  
  // Load saved window state or use defaults
  const savedState = await loadWindowState();
  const windowWidth = savedState?.width || 300;
  const windowHeight = savedState?.height || 300;
  const windowX = savedState?.x ?? (screenWidth - (windowWidth + screenPadding));
  const windowY = savedState?.y ?? screenPadding;
  
  // Update the current expanded height if we have saved state
  if (savedState?.currentExpandedHeight) {
    currentExpandedHeight = savedState.currentExpandedHeight;
  }

  mainWindow = new BrowserWindow({
    frame: false,
    alwaysOnTop: true,
    titleBarStyle: 'hiddenInset', 
    transparent: true,
    show: false,
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    roundedCorners: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    // macOS-specific properties to ensure no frame is shown
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 0, y: 0 }, // Move traffic lights off-screen
    }),
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
      if (currentHeight > TITLE_BAR_HEIGHT_PX + 10) {
        // Add a small buffer to avoid misinterpreting title bar height as a resize
        currentExpandedHeight = currentHeight;
        log.info(`Updated expanded height to: ${currentExpandedHeight}`);
      }
    }
    // Save window state after resize
    saveWindowState();
  });

  mainWindow.on('move', () => {
    // Save window state after move
    saveWindowState();
  });

  mainWindow.on('close', () => {
    // Save window state before closing
    saveWindowState();
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
