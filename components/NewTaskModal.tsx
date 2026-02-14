
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { TaskPriority, Task, TaskStatus } from '../types';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  initialData?: Task | null;
  defaultDate?: string;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onSave, initialData, defaultDate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setDueDate(initialData.due_date ? new Date(initialData.due_date).toISOString().split('T')[0] : '');
      setPriority(initialData.priority);
    } else {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
      setPriority(TaskPriority.MEDIUM);
    }
  }, [initialData, isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      due_date: dueDate,
      priority,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-800/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-2xl shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-accent p-6 border-b-4 border-slate-800 flex items-center justify-between text-white">
          <h2 className="text-2xl font-heading">{initialData ? 'Edit Task' : 'Add New Task'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>
        
        <form className="p-6 space-y-6" onSubmit={handleSubmit}>
          <Input 
            label="Task Title" 
            placeholder="What needs to be done?" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          
          <Input 
            label="Description" 
            isTextArea 
            placeholder="Add some details..." 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Due Date" 
              type="date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Priority</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full p-3 bg-white border-2 border-slate-200 rounded-lg font-medium outline-none focus:border-accent"
              >
                <option value={TaskPriority.LOW}>Low</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.HIGH}>High</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" type="submit">{initialData ? 'Update Task' : 'Create Task'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
