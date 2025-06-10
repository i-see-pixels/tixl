// app/components/TodoCard.tsx

import React, { useState, useEffect, useRef } from 'react';
import { TodoItem } from '../../shared/types';
import './TodoCard.css'; // Use a new CSS Module for the card
import { Trash2, Pencil } from 'lucide-react'; // Icons

interface TodoCardProps {
  todo: TodoItem;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEditSave: (id: string, newText: string) => void;
  // Drag and drop props will be passed down to the li element
  draggable: boolean;
  onDragStart: (e: React.DragEvent<HTMLLIElement>, todo: TodoItem) => void;
  onDragOver: (e: React.DragEvent<HTMLLIElement>, todo: TodoItem) => void;
  onDragLeave: (e: React.DragEvent<HTMLLIElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLLIElement>) => void;
  // Prop to control if this specific card is in edit mode from parent (TodoList)
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
}

const TodoCard: React.FC<TodoCardProps> = ({
  todo,
  onToggleComplete,
  onDelete,
  onEditSave,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isEditing, // Use this prop to know if *this* card should show the editor
  onStartEdit,
  onCancelEdit,
}) => {
  const [currentText, setCurrentText] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state with external prop when isEditing changes
  useEffect(() => {
    if (isEditing) {
      setCurrentText(todo.text);
      // Focus the input when editing starts
      // Use a small timeout to ensure input is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isEditing, todo.text]);

  const handleSave = () => {
    if (currentText.trim()) {
      onEditSave(todo.id, currentText.trim());
    } else {
      // Optionally delete if text is cleared during edit
      onDelete(todo.id);
    }
    onCancelEdit(); // Exit edit mode regardless
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const handleBlur = () => {
    // If text was cleared, delete the todo. Otherwise, save if text is present.
    if (!currentText.trim()) {
      onDelete(todo.id);
    } else if (currentText.trim() !== todo.text) {
      // Only save if text actually changed
      handleSave();
    } else {
      // If text didn't change and blur happens, just cancel edit mode
      onCancelEdit();
    }
  };

  return (
    <li
      className={`todoCard ${todo.completed ? 'completed' : ''}`}
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, todo)}
      onDragOver={(e) => onDragOver(e, todo)}
      onDragLeave={(e) => onDragLeave(e)}
      onDrop={(e) => onDrop(e)}
      onDragEnd={(e) => onDragEnd(e)}
    >
      {isEditing ? (
        <div className="editForm">
          <input
            ref={inputRef}
            type="text"
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="editInput"
          />
          {/* No explicit save/cancel buttons in Trello-like simple edit */}
          {/* Adding buttons back if preferred, remove if not needed */}
          {/* <button onClick={handleSave} className='saveButton'>Save</button>
                    <button onClick={onCancelEdit} className='cancelButton'>Cancel</button> */}
        </div>
      ) : (
        <>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggleComplete(todo.id)}
            className="checkbox"
          />
          {/* Clicking the text initiates edit */}
          <span className="todoText" onClick={() => onStartEdit(todo.id)}>
            {todo.text}
          </span>
          {/* Icons for actions */}
          {/* <button onClick={() => onStartEdit(todo.id)} className='editButton'>
                        <Pencil size={14} />
                    </button> */}
          <button onClick={() => onDelete(todo.id)} className="deleteButton">
            <Trash2 size={14} />
          </button>
        </>
      )}
    </li>
  );
};

export default TodoCard;
