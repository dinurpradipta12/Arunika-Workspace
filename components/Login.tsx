
import React, { useState } from 'react';
import { CheckSquare, Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('arunika@taskplay.com');
  const [password, setPassword] = useState('ar4925');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.includes('@') ? email : `${email}@taskplay.com`,
        password: password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (data.session) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid login credentials. Please check your Supabase Auth dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen dot-grid flex items-center justify-center p-4">
      <div className="fixed top-20 left-20 w-32 h-32 bg-secondary/20 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-48 h-48 bg-tertiary/20 rounded-full blur-3xl" />
      <div className="fixed top-1/2 left-10 w-12 h-12 bg-accent/20 rotate-45" />

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-accent rounded-2xl border-4 border-slate-800 shadow-pop flex items-center justify-center text-white mb-4 rotate-3">
            <CheckSquare size={32} strokeWidth={3} />
          </div>
          <h1 className="text-4xl font-heading tracking-tight">TaskPlay</h1>
          <p className="text-mutedForeground font-bold uppercase tracking-widest text-[10px] mt-2">Authenticated Realtime Sync</p>
        </div>

        <div className="bg-white border-4 border-slate-800 rounded-2xl shadow-[12px_12px_0px_0px_#1E293B] p-8 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-tertiary rounded-full border-2 border-slate-800" />
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-11 text-mutedForeground" />
              <Input 
                label="Email or Username" 
                placeholder="arunika@taskplay.com" 
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-11 text-mutedForeground" />
              <Input 
                label="Password" 
                type="password" 
                placeholder="••••••••" 
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-xs font-bold leading-relaxed">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button variant="primary" className="w-full text-lg py-4" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Let's Go"}
            </Button>
          </form>

          <p className="text-center mt-8 text-[10px] text-mutedForeground font-medium leading-relaxed">
            Note: Uses Supabase Auth. Make sure the user exists in your dashboard.<br/>
            Default Sync ID: <span className="font-bold text-accent">arunika@taskplay.com / ar4925</span>
          </p>
        </div>
      </div>
    </div>
  );
};
