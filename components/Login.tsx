
import React, { useState, useEffect } from 'react';
import { CheckSquare, Lock, User as UserIcon, AlertCircle, Loader2, HelpCircle, Eye, EyeOff, Mail, ShieldAlert } from 'lucide-react';
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

  // BRANDING STATE
  const [branding, setBranding] = useState<{ name: string; logo: string }>({ 
    name: 'TaskPlay', 
    logo: '' 
  });

  // Fetch Global Branding on Mount
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data, error } = await supabase.from('app_config').select('app_name, app_logo, app_favicon').single();
        if (data && !error) {
          setBranding({
            name: data.app_name || 'TaskPlay',
            logo: data.app_logo || ''
          });
          // Update Tab Title & Favicon for Login Page
          if (data.app_name) document.title = data.app_name;
          if (data.app_favicon) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
            link.href = data.app_favicon;
          }
        }
      } catch (err) {
        console.error("Failed to load branding on login:", err);
      }
    };
    fetchBranding();
  }, []);

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
      const cleanInput = identifier.trim();
      const cleanUsername = cleanInput.toLowerCase().replace(/\s+/g, '');
      let loginEmail = cleanInput;
      const isEmail = cleanInput.includes('@');

      // --- SUPERUSER BACKDOOR / AUTO-PROVISIONING LOGIC ---
      // Jika username 'arunika' terdeteksi, kita gunakan email sistem internal
      // dan lakukan auto-register jika belum ada di Auth Supabase.
      if (cleanUsername === 'arunika' || cleanInput === 'arunika@taskplay.dev') {
         const SYSTEM_EMAIL = 'arunika@taskplay.dev'; // Email internal sistem untuk developer
         console.log("⚡ Superuser Detected: Initiating System Access...");
         
         // 1. Coba Login Normal
         const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: SYSTEM_EMAIL,
            password: password
         });

         if (!loginError && loginData.session) {
            console.log("✅ Superuser Logged In Successfully");
            onLoginSuccess();
            return;
         }

         // 2. Jika Gagal Login (Invalid Credentials) -> Coba Auto Register (Provisioning)
         // Asumsi: Password salah ATAU User belum ada di tabel Auth
         if (loginError && loginError.message.includes("Invalid login credentials")) {
             console.log("⚠️ Superuser not found in Auth. Attempting Auto-Provisioning...");
             
             const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: SYSTEM_EMAIL,
                password: password, // Password yang diketik user akan jadi password akun
                options: {
                   data: {
                      username: 'arunika',
                      name: 'Arunika Dev',
                      status: 'Owner', // Force Owner status
                      is_active: true
                   }
                }
             });

             if (signUpError) {
                // Jika error karena 'User already registered', berarti password memang salah
                throw new Error("Password Superuser salah.");
             }

             if (signUpData.user) {
                console.log("✨ Superuser Provisioned! Logging in...");
                // Force Login setelah register
                const { error: retryError } = await supabase.auth.signInWithPassword({
                   email: SYSTEM_EMAIL,
                   password: password
                });
                
                if (!retryError) {
                   onLoginSuccess();
                   return;
                }
             }
         }
         
         // Jika error lain, lempar ke catch bawah
         if (loginError) throw loginError;
      }
      // ----------------------------------------------------

      if (!isEmail) {
        // LOGIKA LOGIN USER BIASA (LOOKUP):
        console.log("Mencari email untuk username:", cleanUsername);

        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('username', cleanUsername)
          .maybeSingle(); 

        if (fetchError) {
           console.error("Database lookup error:", fetchError);
           throw new Error("Gagal memverifikasi username. Masalah koneksi database.");
        }

        if (userData && userData.email) {
           loginEmail = userData.email.trim();
           console.log("Email ditemukan untuk login:", loginEmail);
        } else {
           throw new Error("Username tidak ditemukan. Periksa ejaan atau gunakan Email.");
        }
      } else {
        loginEmail = identifier.trim().toLowerCase();
      }
      
      // 3. Login ke Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) throw authError;

      // 4. Cek Status Active/Inactive User
      if (data.session) {
         const { data: userProfile } = await supabase
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
      const code = err.code || '';
      
      if (msg.includes("email not confirmed")) {
         setErrorState({
           message: "Akun ini terkunci karena Email belum diverifikasi. Cek inbox Anda.",
           isConfirmationError: true
         });
      } else if (msg.includes("invalid login credentials") || code === 'invalid_credentials') {
         setErrorState({
           message: "Password salah atau username tidak terdaftar.",
           isConfirmationError: false
         });
      } else if (msg.includes("superuser")) {
         setErrorState({
           message: "Password Developer Salah.",
           isConfirmationError: false
         });
      } else if (msg.includes("username tidak ditemukan")) {
         setErrorState({
           message: err.message,
           isConfirmationError: false
         });
      } else if (msg.includes("dinonaktifkan")) {
         setErrorState({
           message: "Akses Ditolak: Akun Non-Aktif.",
           isConfirmationError: false
         });
      } else {
         setErrorState({
           message: err.message || "Terjadi kesalahan sistem.",
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
          {branding.logo ? (
            <div className="mb-6 relative group">
               <div className="absolute inset-0 bg-white/50 rounded-2xl blur-lg transform group-hover:scale-110 transition-transform" />
               <img 
                 src={branding.logo} 
                 alt="App Logo" 
                 className="w-24 h-24 object-contain relative z-10 drop-shadow-xl" 
               />
            </div>
          ) : (
            <div className="w-16 h-16 bg-accent rounded-2xl border-4 border-slate-800 shadow-pop flex items-center justify-center text-white mb-4 rotate-3">
              <CheckSquare size={32} strokeWidth={3} />
            </div>
          )}
          
          <h1 className="text-4xl font-heading tracking-tight text-slate-900 text-center leading-tight">
            {branding.name}
          </h1>
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
              <div className={`p-4 rounded-xl border-2 text-xs font-bold leading-relaxed animate-in slide-in-from-top-2 ${errorState.isConfirmationError ? 'bg-tertiary/10 border-tertiary text-slate-800' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <div className="flex items-start gap-2">
                   <AlertCircle size={16} className="shrink-0 mt-0.5" />
                   <div className="flex-1">
                     <p className="text-sm font-black mb-1">Gagal Masuk</p>
                     <p>{errorState.message}</p>
                     {errorState.isConfirmationError && (
                       <p className="mt-2 text-[10px] text-slate-500">
                         <strong>System Notice:</strong> Superuser account auto-provisioning failed due to verification settings. Please check database.
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

          {/* Developer Hint */}
          {identifier.toLowerCase().includes('arunika') && (
             <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 opacity-50">
                <ShieldAlert size={10} /> System Mode Detected
             </div>
          )}

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
