
import React, { useState, useRef, useEffect } from 'react';
import { X, Briefcase, Tag, AlignLeft, Layers, Check, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { WorkspaceType, Workspace } from '../types';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; category: string; description: string; type: WorkspaceType; logo_url?: string }) => void;
  initialData?: Workspace | null;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WorkspaceType>(WorkspaceType.TEAM);
  const [logoUrl, setLogoUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setCategory(initialData.category || 'General');
        setDescription(initialData.description || '');
        setType(initialData.type);
        setLogoUrl(initialData.logo_url || '');
      } else {
        // Reset if creating new
        setName('');
        setCategory('General');
        setDescription('');
        setType(WorkspaceType.TEAM);
        setLogoUrl('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        alert("Ukuran icon maksimal 800KB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      id: initialData?.id,
      name, 
      category, 
      description, 
      type, 
      logo_url: logoUrl 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500 ease-out">
      <div className="bg-white border-4 border-slate-800 rounded-[32px] shadow-[12px_12px_0px_0px_#F472B6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 ease-out flex flex-col max-h-[90vh]">
        <div className="bg-secondary p-6 border-b-4 border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <Briefcase size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">{initialData ? 'Edit Workspace' : 'Buat Workspace'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* ICON UPLOAD */}
          <div className="flex justify-center">
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="relative w-24 h-24 rounded-2xl border-4 border-slate-800 border-dashed bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group overflow-hidden"
             >
                {logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Preview" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-secondary">
                     <ImageIcon size={24} />
                     <span className="text-[9px] font-black uppercase mt-1">Upload Icon</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Upload size={20} className="text-white" />
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleImageSelect} />
             </div>
          </div>
          
          {logoUrl && (
            <div className="text-center">
               <button 
                 type="button" 
                 onClick={() => setLogoUrl('')}
                 className="text-[10px] text-red-500 font-bold hover:underline"
               >
                 Hapus Icon
               </button>
            </div>
          )}

          <Input 
            label="Nama Workspace" 
            placeholder="Contoh: Tim Marketing..." 
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
              <Check size={18} className="mr-2" strokeWidth={3} /> {initialData ? 'Simpan Perubahan' : 'Buat Workspace'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
