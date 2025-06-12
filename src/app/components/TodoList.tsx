// app/components/TodoList.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TodoItem } from '../../shared/types'; // Adjust path if needed
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import { Plus, SquareMenu, SquareMinus } from 'lucide-react';

// Import CSS Module
import './TodoList.css';
import TodoCard from './TodoCard';

// Install uuid: npm install uuid @types/uuid

const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  // const [newTodoText, setNewTodoText] = useState('');
  // const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [isAddingNewTodo, setIsAddingNewTodo] = useState(false);
  const [newTodoInputText, setNewTodoInputText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const addTodoInputRef = useRef<HTMLInputElement>(null);

  const draggedItem = useRef<TodoItem | null>(null);
  const dragOverItem = useRef<TodoItem | null>(null);
  const dragOverElement = useRef<HTMLLIElement | null>(null);

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
      setTodos(
        Array.isArray(loadedTodos)
          ? loadedTodos.sort((a, b) => a.order - b.order)
          : [],
      );
    } catch (error) {
      console.error('Failed to load todos:', error);
      setTodos([]);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (isAddingNewTodo) {
      addTodoInputRef.current?.focus();
    }
  }, [isAddingNewTodo]);

  // --- To-Do Item Actions ---
  const addTodo = useCallback(() => {
    if (newTodoInputText.trim()) {
      // Find the maximum order to add the new item at the end
      const maxOrder =
        todos.length > 0 ? Math.max(...todos.map((t) => t.order)) : -1;

      const newTodo: TodoItem = {
        id: uuidv4(),
        text: newTodoInputText.trim(),
        completed: false,
        order: maxOrder + 1, // Add at the end
      };
      const updatedTodos = [...todos, newTodo]; // Add to the array
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setNewTodoInputText(''); // Clear input
      setIsAddingNewTodo(false); // Exit adding mode
    } else {
      // If input is empty, just exit adding mode without adding
      setIsAddingNewTodo(false);
    }
  }, [todos, newTodoInputText, saveTodos]);

  const toggleComplete = useCallback(
    (id: string) => {
      const updatedTodos = todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      );
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
    },
    [todos, saveTodos],
  );

  const deleteTodo = useCallback(
    (id: string) => {
      const updatedTodos = todos.filter((todo) => todo.id !== id);
      // Re-assign order to maintain sequential values after deletion
      const reorderedTodos = updatedTodos.map((todo, index) => ({
        ...todo,
        order: index,
      }));
      setTodos(reorderedTodos);
      saveTodos(reorderedTodos);
      // If the deleted todo was being edited, exit edit mode
      if (editingTodoId === id) {
        setEditingTodoId(null);
      }
      // If the deleted todo was the one being dragged, clear ref
      if (draggedItem.current?.id === id) {
        draggedItem.current = null;
      }
    },
    [todos, editingTodoId, saveTodos],
  );

  const startEdit = useCallback(
    (id: string) => {
      // Only allow one item to be edited at a time, and not while adding a new one
      if (!isAddingNewTodo) {
        setEditingTodoId(id);
      }
    },
    [isAddingNewTodo],
  );

  const saveEdit = useCallback(
    (id: string, newText: string) => {
      if (newText.trim()) {
        const updatedTodos = todos.map((todo) =>
          todo.id === id ? { ...todo, text: newText.trim() } : todo,
        );
        setTodos(updatedTodos);
        saveTodos(updatedTodos);
      } else {
        // If text was cleared, delete the todo
        deleteTodo(id);
      }
      setEditingTodoId(null); // Exit edit mode
    },
    [todos, saveTodos, deleteTodo],
  );

  const cancelEdit = useCallback(() => {
    setEditingTodoId(null);
  }, []);

  const handleAddNewKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTodo(); // Call the addTodo function
    } else if (e.key === 'Escape') {
      setNewTodoInputText(''); // Clear input
      setIsAddingNewTodo(false); // Exit adding mode
    }
  };

  const handleAddNewBlur = () => {
    // If the input is empty when blurred, just exit adding mode
    if (!newTodoInputText.trim()) {
      setIsAddingNewTodo(false);
    }
    // If there's text, we assume the user intended to add and will press Enter.
    // If they blur without pressing Enter, the text remains in the input until
    // they click + Add or Escape. This mimics some list UIs.
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    todo: TodoItem,
  ) => {
    draggedItem.current = todo;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todo.id);
    // Add a class for visual feedback directly on the LI element
    e.currentTarget.classList.add('dragging'); // Use styles from TodoList for overall list
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLLIElement>,
    todo: TodoItem,
  ) => {
    e.preventDefault(); // Essential to allow a drop
    // Prevent dropping onto the "Add New" card itself
    if (todo.id === 'add-new') return; // Assuming a placeholder ID for the Add New card if it was an item

    dragOverItem.current = todo;
    // Remove previous drag over classes from the old element
    if (
      dragOverElement.current &&
      dragOverElement.current !== e.currentTarget
    ) {
      dragOverElement.current.classList.remove(
        'dragOverAbove',
        'dragOverBelow',
      );
    }
    dragOverElement.current = e.currentTarget;

    // Add hover class based on mouse position relative to the target LI
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height / 2) {
      e.currentTarget.classList.add('dragOverAbove');
      e.currentTarget.classList.remove('dragOverBelow');
    } else {
      e.currentTarget.classList.add('dragOverBelow');
      e.currentTarget.classList.remove('dragOverAbove');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    // Clean up drag over styles when leaving the element
    e.currentTarget.classList.remove('dragOverAbove', 'dragOverBelow');
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    // Clean up drag over styles from the last element hovered
    if (dragOverElement.current) {
      dragOverElement.current.classList.remove(
        'dragOverAbove',
        'dragOverBelow',
      );
    }

    if (draggedItem.current && dragOverItem.current) {
      const draggedId = draggedItem.current.id;
      const dropId = dragOverItem.current.id;

      if (draggedId === dropId) {
        // Dropped on itself, no change
        return;
      }

      const newTodos = [...todos];
      const draggedIndex = newTodos.findIndex((t) => t.id === draggedId);
      const dropIndex = newTodos.findIndex((t) => t.id === dropId);

      if (draggedIndex === -1 || dropIndex === -1) {
        console.warn('Drag or drop item not found in list state.');
        return; // Should not happen if state is consistent
      }

      // Determine effective drop position (above or below)
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const insertBefore = y < rect.height / 2;

      const [removed] = newTodos.splice(draggedIndex, 1);

      // Calculate the target index for insertion
      let targetIndex = dropIndex;
      if (!insertBefore) {
        targetIndex = dropIndex + 1;
        // If we're inserting *after* the drop target and the dragged item
        // was originally *before* the drop target, the indices shift.
        // If draggedIndex < dropIndex, we removed an item *before* the insertion point,
        // so the targetIndex needs to be decremented by 1.
        if (draggedIndex < dropIndex) {
          targetIndex--;
        }
      } else {
        // If we're inserting *before* the drop target and the dragged item
        // was originally *after* the drop target, the indices shift.
        if (draggedIndex > dropIndex) {
          // targetIndex stays the same (dropIndex)
        } else {
          // If draggedIndex < dropIndex (inserting before itself),
          // this case shouldn't happen or is handled by dropId === draggedId check.
          // But being explicit: if draggedIndex < dropIndex, targetIndex should be dropIndex - 1? No, it's just dropIndex
        }
      }

      // Ensure targetIndex is within bounds
      targetIndex = Math.max(0, Math.min(newTodos.length, targetIndex));

      // Insert the item at the target index
      newTodos.splice(targetIndex, 0, removed);

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
    dragOverElement.current = null; // Clear element ref
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    // Clean up any remaining drag styles from the dragged element
    if (e.currentTarget) {
      e.currentTarget.classList.remove('dragging');
    }
    // Clean up any remaining drag over styles from the list
    document
      .querySelectorAll(`.dragOverAbove, .dragOverBelow`)
      .forEach((el) => {
        el.classList.remove('dragOverAbove', 'dragOverBelow');
      });

    draggedItem.current = null;
    dragOverItem.current = null;
    dragOverElement.current = null;
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      window.electronAPI.toggleCollapse(); // Tell main process to resize window
      // When collapsing, exit any adding or editing modes
      if (newState) {
        setIsAddingNewTodo(false);
        setEditingTodoId(null);
        setNewTodoInputText(''); // Clear input too
      }
      return newState;
    });
  };

  return (
    <div className={'container'}>
      {/* Custom Title Bar / Drag Area */}
      <div className={'titleBar'}>
        <div className={'dragRegion'}></div>
        <div className={'windowControls'}>
          <button onClick={handleToggleCollapse}>
            {isCollapsed ? <SquareMenu /> : <SquareMinus />}
          </button>
        </div>
      </div>

      {/* Content Area - Conditionally show/hide */}
      <div className={`.content ${isCollapsed ? 'collapsedContent' : ''}`}>
        <ul className={'todoList'}>
          {/* Render regular todo cards */}
          {todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onToggleComplete={toggleComplete}
              onDelete={deleteTodo}
              onEditSave={saveEdit}
              draggable={!isAddingNewTodo && editingTodoId !== todo.id} // Make draggable only when not adding/editing
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isEditing={editingTodoId === todo.id} // Pass down whether *this* card is being edited
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
            />
          ))}

          {/* --- NEW: The "Add New Todo" Card --- */}
          <li
            className={`todoCard addCard ${isAddingNewTodo ? 'draggingadding' : ''}`}
            onClick={() => !isAddingNewTodo && setIsAddingNewTodo(true)} // Click to activate adding mode
            draggable={false} // Add card is not draggable
            onDragOver={(e) => e.preventDefault()} // Allow drops ONTO the list, but not ON the add card
            onDrop={(e) => handleDrop(e)} // Drop onto the list container itself
          >
            {!isAddingNewTodo ? (
              <>
                <Plus size={16} className={'addIcon'} />
                <span className={'addText'}>Add a todo</span>
              </>
            ) : (
              <div className={'addInputForm'}>
                <input // Use textarea for multi-line input like Trello
                  ref={addTodoInputRef}
                  value={newTodoInputText}
                  onChange={(e) => setNewTodoInputText(e.target.value)}
                  onKeyDown={handleAddNewKeyDown} // Handle Enter/Escape
                  onBlur={handleAddNewBlur} // Handle blur
                  placeholder="Enter a title for this todo..."
                  className={'addInput'}
                />
                {/* Optional: Add a "Cancel" button if blur isn't enough */}
                {/* <button onClick={() => setIsAddingNewTodo(false)} className={styles.cancelAddButton}>Cancel</button> */}
              </div>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TodoList;
