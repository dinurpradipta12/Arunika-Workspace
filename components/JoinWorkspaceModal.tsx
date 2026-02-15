
import React, { useState } from 'react';
import { X, Key, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';

interface JoinWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const JoinWorkspaceModal: React.FC<JoinWorkspaceModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('join_workspace_by_code', { code_input: code.trim() });
      
      if (error) throw error;
      
      if (data && data.success) {
        onSuccess();
        onClose();
        setCode('');
      } else {
        setError(data?.message || 'Kode tidak valid atau kadaluarsa.');
      }
    } catch (err: any) {
      console.error("Join Error:", err);
      setError(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500 ease-out">
      <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[12px_12px_0px_0px_#8B5CF6] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-500 ease-out">
        <div className="bg-accent p-6 border-b-4 border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Key size={24} strokeWidth={3} />
            <h2 className="text-xl font-heading">Join Workspace</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <form onSubmit={handleJoin} className="p-6 space-y-6">
          <div className="text-center">
             <p className="text-sm font-bold text-slate-500">Masukkan kode akses unik yang diberikan oleh Owner Workspace.</p>
          </div>

          <div className="relative">
            <input 
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
              placeholder="XXXXXX"
              className="w-full text-center text-3xl font-heading tracking-[0.5em] py-4 border-4 border-slate-200 rounded-2xl focus:border-accent outline-none uppercase placeholder:text-slate-200"
              maxLength={8}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-xs font-bold justify-center">
               <AlertCircle size={16} /> {error}
            </div>
          )}

          <Button variant="primary" className="w-full shadow-pop" type="submit" disabled={isLoading || code.length < 3}>
             {isLoading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2">Gabung Sekarang <ArrowRight size={18} strokeWidth={3} /></span>}
          </Button>
        </form>
      </div>
    </div>
  );
};
