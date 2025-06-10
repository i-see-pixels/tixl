export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

// This type will be extended to provide type safety for window.electronAPI in the renderer
declare global {
  interface Window {
    electronAPI: {
      loadTodos: () => Promise<TodoItem[]>;
      saveTodos: (todos: TodoItem[]) => Promise<void>;
      closeApp: () => void;
      // minimizeApp: () => void;
      maximizeApp: () => void;
      setAlwaysOnTop: (status: boolean) => void;
      toggleCollapse: () => void;
    };
  }
}
