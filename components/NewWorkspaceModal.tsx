
import React, { useState } from 'react';
import { X, Briefcase, Tag, AlignLeft, Layers, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { WorkspaceType } from '../types';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; category: string; description: string; type: WorkspaceType }) => void;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WorkspaceType>(WorkspaceType.TEAM);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, category, description, type });
    // Reset form
    setName('');
    setCategory('General');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500 ease-out">
      <div className="bg-white border-4 border-slate-800 rounded-[32px] shadow-[12px_12px_0px_0px_#F472B6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 ease-out">
        <div className="bg-secondary p-6 border-b-4 border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Briefcase size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">Buat Workspace</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <Input 
            label="Nama Workspace" 
            placeholder="Contoh: Tim Marketing, Proyek Alpha..." 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="font-bold"
            icon={<Layers size={18} />}
          />

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Kategori</label>
            <div className="relative">
              <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-secondary appearance-none transition-all"
              >
                <option value="General">General</option>
                <option value="Marketing">Marketing</option>
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tipe Workspace</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType(WorkspaceType.TEAM)}
                className={`p-3 border-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${type === WorkspaceType.TEAM ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                <Briefcase size={14} /> Team
              </button>
              <button
                type="button"
                onClick={() => setType(WorkspaceType.PERSONAL)}
                className={`p-3 border-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${type === WorkspaceType.PERSONAL ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                <Layers size={14} /> Personal
              </button>
            </div>
          </div>

          <Input 
            label="Deskripsi Singkat" 
            isTextArea
            placeholder="Jelaskan tujuan workspace ini..." 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px]"
            icon={<AlignLeft size={18} />}
          />

          <div className="pt-2">
            <Button variant="primary" className="w-full bg-secondary shadow-pop" type="submit">
              <Check size={18} className="mr-2" strokeWidth={3} /> Buat Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
