// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { TodoItem } from '../shared/types';

export type Channels = 'ipc-example';

export type ElectronAPI = {
  loadTodos: () => Promise<TodoItem[]>;
  saveTodos: (todos: TodoItem[]) => Promise<void>;
  closeApp: () => void;
  // minimizeApp: () => void;
  maximizeApp: () => void;
  setAlwaysOnTop: (status: boolean) => void;
  toggleCollapse: () => void;
};

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('electronAPI', {
  loadTodos: () => ipcRenderer.invoke('load-todos'),
  saveTodos: (todos: TodoItem[]) => ipcRenderer.invoke('save-todos', todos),
  closeApp: () => ipcRenderer.send('close'),
  // minimizeApp: () => ipcRenderer.send('minimize'),
  maximizeApp: () => ipcRenderer.send('maximize'),
  setAlwaysOnTop: (status: boolean) =>
    ipcRenderer.send('set-always-on-top', status),
  toggleCollapse: () => ipcRenderer.send('toggle-collapse'),
});

export type ElectronHandler = typeof electronHandler;
