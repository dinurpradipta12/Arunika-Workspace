
import React, { useState, useEffect } from 'react';
import { CheckSquare, Lock, User as UserIcon, AlertCircle, Loader2, HelpCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLoginSuccess: () => void;
  initialMessage?: string | null;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, initialMessage }) => {
  const [identifier, setIdentifier] = useState(''); // Bisa Username atau Email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorState, setErrorState] = useState<{message: string, isConfirmationError: boolean} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [rawError, setRawError] = useState<any>(null);

  useEffect(() => {
    if (initialMessage) {
      setErrorState({
        message: initialMessage,
        isConfirmationError: false
      });
    }
  }, [initialMessage]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorState(null);
    setRawError(null);

    try {
      let loginEmail = identifier.trim();
      const isEmail = identifier.includes('@');

      if (!isEmail) {
        // LOGIKA HYBRID:
        const cleanUsername = identifier.trim().toLowerCase();
        
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('username', cleanUsername)
          .single();

        if (userData && userData.email) {
           loginEmail = userData.email;
        } else {
           // Fallback Legacy
           console.warn("Username tidak ditemukan di public DB, mencoba format legacy...");
           loginEmail = `${cleanUsername}@taskplay.com`;
        }
      } else {
        loginEmail = identifier.trim().toLowerCase();
      }
      
      console.log("Attempting login with:", loginEmail);

      // Login ke Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) throw authError;

      // CEK STATUS ACTIVE/INACTIVE
      if (data.session) {
         const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', data.session.user.id)
            .single();

         if (userProfile && userProfile.is_active === false) {
             await supabase.auth.signOut();
             throw new Error("Akun Anda telah dinonaktifkan oleh Administrator.");
         }

        onLoginSuccess();
      } else {
        throw new Error("Sesi tidak valid.");
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setRawError(err);
      
      const msg = err.message?.toLowerCase() || '';
      
      if (msg.includes("email not confirmed")) {
         setErrorState({
           message: "Akun ini terkunci karena Email belum diverifikasi.",
           isConfirmationError: true
         });
      } else if (msg.includes("invalid login credentials")) {
         setErrorState({
           message: "Username atau Password salah.",
           isConfirmationError: false
         });
      } else if (msg.includes("dinonaktifkan")) {
         setErrorState({
           message: "Akses Ditolak: Akun Non-Aktif.",
           isConfirmationError: false
         });
      } else {
         setErrorState({
           message: err.message || "Terjadi kesalahan koneksi.",
           isConfirmationError: false
         });
      }
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
          <h1 className="text-4xl font-heading tracking-tight text-slate-900">TaskPlay</h1>
          <p className="text-mutedForeground font-bold uppercase tracking-widest text-[10px] mt-2 text-center leading-relaxed">
            Sistem Manajemen Task & Penjadwalan <br/>
            <span className="text-accent">Personal Productivity</span>
          </p>
        </div>

        <div className="bg-white border-4 border-slate-800 rounded-2xl shadow-[12px_12px_0px_0px_#1E293B] p-8 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-tertiary rounded-full border-2 border-slate-800" />
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-11 text-mutedForeground" />
              <Input 
                label="Username atau Email" 
                placeholder="Masukan username..." 
                className="pl-10"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setErrorState(null); }}
                required
                autoCapitalize="none"
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-11 text-mutedForeground" />
              <Input 
                label="Password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorState(null); }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-11 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {errorState && (
              <div className={`p-4 rounded-xl border-2 text-xs font-bold leading-relaxed animate-in slide-in-from-top-2 ${errorState.isConfirmationError ? 'bg-tertiary/10 border-tertiary text-slate-800' : 'bg-secondary/10 border-secondary text-secondary'}`}>
                <div className="flex items-start gap-2">
                   <AlertCircle size={16} className="shrink-0 mt-0.5" />
                   <div className="flex-1">
                     <p className="text-sm font-black mb-1">Gagal Masuk</p>
                     <p>{errorState.message}</p>
                     {errorState.isConfirmationError && (
                       <p className="mt-2 text-[10px] text-slate-500">
                         <strong>Tips Admin:</strong> Jalankan script SQL berikut di Dashboard untuk mem-bypass verifikasi:<br/>
                         <code className="block bg-slate-100 p-1 mt-1 rounded border border-slate-300">
                           UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '...';
                         </code>
                       </p>
                     )}
                   </div>
                </div>
              </div>
            )}

            <Button variant="primary" className="w-full text-lg py-4 shadow-pop" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Masuk"}
            </Button>
          </form>

          {/* Technical Details Toggler */}
          {rawError && (
             <div className="mt-6 border-t-2 border-slate-100 pt-4 text-center">
                <button 
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-[10px] font-bold text-slate-400 hover:text-accent flex items-center justify-center gap-1 mx-auto"
                >
                  <HelpCircle size={10} /> {showTechnicalDetails ? 'Sembunyikan' : 'Lihat'} Detail Error
                </button>
                
                {showTechnicalDetails && (
                  <div className="mt-2 p-2 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-lg text-left overflow-x-auto max-h-32">
                    <pre>{JSON.stringify(rawError, null, 2)}</pre>
                  </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
