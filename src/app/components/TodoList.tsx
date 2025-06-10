// app/components/TodoList.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TodoItem } from '../../shared/types'; // Adjust path if needed
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import { Check, SquareMenu, SquareMinus, Squircle, X } from 'lucide-react';

// Import CSS Module
import './TodoList.css';

// Install uuid: npm install uuid @types/uuid

const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const draggedItem = useRef<TodoItem | null>(null);
  const dragOverItem = useRef<TodoItem | null>(null);

  // --- Persistence Logic ---
  const saveTodos = useCallback(async (currentTodos: TodoItem[]) => {
    try {
      await window.electronAPI.saveTodos(currentTodos);
    } catch (error) {
      console.error('Failed to save todos:', error);
    }
  }, []);

  const loadTodos = useCallback(async () => {
    try {
      const loadedTodos = await window.electronAPI.loadTodos();
      // Ensure items are sorted by order when loaded
      setTodos(loadedTodos.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('Failed to load todos:', error);
      setTodos([]);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // --- To-Do Item Actions ---
  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      const newTodo: TodoItem = {
        id: uuidv4(),
        text: newTodoText.trim(),
        completed: false,
        order:
          todos.length > 0 ? Math.max(...todos.map((t) => t.order)) + 1 : 0,
      };
      const updatedTodos = [...todos, newTodo];
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setNewTodoText('');
    }
  };

  const toggleComplete = (id: string) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo,
    );
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
  };

  const deleteTodo = (id: string) => {
    const updatedTodos = todos.filter((todo) => todo.id !== id);
    // Re-assign order to maintain sequential values after deletion
    const reorderedTodos = updatedTodos.map((todo, index) => ({
      ...todo,
      order: index,
    }));
    setTodos(reorderedTodos);
    saveTodos(reorderedTodos);
  };

  const startEdit = (todo: TodoItem) => {
    setEditTodoId(todo.id);
    setEditTodoText(todo.text);
  };

  const saveEdit = (id: string) => {
    if (editTodoText.trim()) {
      const updatedTodos = todos.map((todo) =>
        todo.id === id ? { ...todo, text: editTodoText.trim() } : todo,
      );
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setEditTodoId(null);
      setEditTodoText('');
    }
  };

  const cancelEdit = () => {
    setEditTodoId(null);
    setEditTodoText('');
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    todo: TodoItem,
  ) => {
    draggedItem.current = todo;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todo.id); // For robust identification
    // Add a class for visual feedback
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLLIElement>,
    todo: TodoItem,
  ) => {
    e.preventDefault(); // Essential to allow a drop
    dragOverItem.current = todo;
    const currentTarget = e.currentTarget;

    // Remove existing hover classes
    currentTarget.parentNode?.childNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.classList.remove('dragOverAbove', 'dragOverBelow');
      }
    });

    // Add hover class based on mouse position
    const rect = currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top; // Y position relative to the element
    if (y < rect.height / 2) {
      currentTarget.classList.add('dragOverAbove');
    } else {
      currentTarget.classList.add('dragOverBelow');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    // Remove hover classes when leaving
    e.currentTarget.classList.remove('dragOverAbove', 'dragOverBelow');
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (draggedItem.current && dragOverItem.current) {
      const draggedId = draggedItem.current.id;
      const dropId = dragOverItem.current.id;

      if (draggedId === dropId) {
        // Dropped on itself, no change
        return;
      }

      // Remove the "dragging" class from the dragged item
      const draggedElement = document.querySelector('.dragging');
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
      }

      // Remove drag over classes from all items
      document
        .querySelectorAll('.dragOverAbove, .dragOverBelow')
        .forEach((el) => {
          el.classList.remove('dragOverAbove', 'dragOverBelow');
        });

      const newTodos = [...todos];
      const draggedIndex = newTodos.findIndex((t) => t.id === draggedId);
      const dropIndex = newTodos.findIndex((t) => t.id === dropId);

      if (draggedIndex === -1 || dropIndex === -1) return;

      // Determine effective drop position (above or below)
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const insertBefore = y < rect.height / 2;

      const [removed] = newTodos.splice(draggedIndex, 1);
      newTodos.splice(insertBefore ? dropIndex : dropIndex + 1, 0, removed);

      // Update the 'order' property for all todos based on their new index
      const reorderedTodos = newTodos.map((todo, index) => ({
        ...todo,
        order: index,
      }));

      setTodos(reorderedTodos);
      saveTodos(reorderedTodos);
    }
    draggedItem.current = null;
    dragOverItem.current = null;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    // Clean up any remaining drag todoStyles
    e.currentTarget.classList.remove('dragging');
    document
      .querySelectorAll('.dragOverAbove, .dragOverBelow')
      .forEach((el) => {
        el.classList.remove('dragOverAbove', 'dragOverBelow');
      });
    draggedItem.current = null;
    dragOverItem.current = null;
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      window.electronAPI.toggleCollapse(); // Tell main process to resize window
      return newState;
    });
  };

  return (
    <div className="container">
      {/* Custom Title Bar / Drag Area */}
      <div className="titleBar">
        <div className="dragRegion"></div> {/* This entire area is draggable */}
        <div className="windowControls">
          <button onClick={handleToggleCollapse}>
            {isCollapsed ? <SquareMenu /> : <SquareMinus />}
          </button>
        </div>
      </div>

      <div className={`content ${isCollapsed ? 'collapsedContent' : ''}`}>
        <form onSubmit={addTodo} className="addTodoForm">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a new todo..."
            className="addTodoInput"
          />
        </form>

        <ul className="todoList">
          {todos.map((todo) => (
            <li
              key={todo.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, todo)}
              onDragOver={(e) => handleDragOver(e, todo)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`todoItem ${todo.completed ? 'completed' : ''}`}
            >
              {editTodoId === todo.id ? (
                <div className="editForm">
                  <input
                    type="text"
                    value={editTodoText}
                    onChange={(e) => setEditTodoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                    onBlur={() => saveEdit(todo.id)}
                    autoFocus
                    className="editInput"
                  />
                </div>
              ) : (
                <>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleComplete(todo.id)}
                    className="checkbox"
                  />
                  <span onClick={() => startEdit(todo)} className="todoText">
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="deleteButton"
                  >
                    X
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TodoList;
