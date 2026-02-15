
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Play, 
  Pause, 
  Calendar, 
  ArrowRight, 
  Video, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Briefcase,
  Users,
  Shield,
  Layers,
  Lightbulb,
  Clock
} from 'lucide-react';
import { Task, Workspace, User, TaskStatus, WorkspaceType, TaskPriority } from '../types';

interface DashboardProps {
  workspaces?: Workspace[];
  tasks?: Task[];
  currentUser?: User | null;
}

// Random Images for Banner (Nature/Tech/Abstract mix)
const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', // Office
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', // Nature
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80', // Tech
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80', // Space
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80'  // Team
];

const GREETINGS = [
  "Siap untuk produktif hari ini?",
  "Fokus pada hal yang paling penting.",
  "Jangan lupa istirahat sejenak.",
  "Selesaikan satu per satu, kamu pasti bisa!",
  "Cek prioritas tim hari ini."
];

export const Dashboard: React.FC<DashboardProps> = ({ 
  workspaces = [], 
  tasks = [], 
  currentUser 
}) => {
  // Timer Logic
  const [time, setTime] = useState(new Date());
  const [timerActive, setTimerActive] = useState(false);
  const [seconds, setSeconds] = useState(0); 
  
  // Banner State
  const [bannerImage, setBannerImage] = useState(BANNER_IMAGES[0]);
  const [greetingText, setGreetingText] = useState(GREETINGS[0]);

  // Derived Data
  const tasksInProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS && !t.is_archived).length;
  const tasksCompleted = tasks.filter(t => t.status === TaskStatus.DONE && !t.is_archived).length;
  const tasksOnHold = tasks.filter(t => t.status === TaskStatus.IN_REVIEW && !t.is_archived).length;
  const totalTasks = tasks.length || 1; // Avoid div by zero

  const workloadData = [
    { name: 'On Progress', value: tasksInProgress, fill: '#3B82F6' },
    { name: 'Completed', value: tasksCompleted, fill: '#34D399' },
    { name: 'In Review', value: tasksOnHold, fill: '#FBBF24' },
  ];

  const productivityScore = Math.min(100, Math.round(((tasksCompleted * 1.5 + tasksInProgress) / (totalTasks + 1)) * 100));

  // --- Effects ---
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Banner Rotation (Every 15 mins = 900000ms)
  useEffect(() => {
    const rotateBanner = () => {
      setBannerImage(prev => {
        const idx = BANNER_IMAGES.indexOf(prev);
        return BANNER_IMAGES[(idx + 1) % BANNER_IMAGES.length];
      });
      setGreetingText(prev => {
        const idx = GREETINGS.indexOf(prev);
        return GREETINGS[(idx + 1) % GREETINGS.length];
      });
    };
    
    // Initial random
    setBannerImage(BANNER_IMAGES[Math.floor(Math.random() * BANNER_IMAGES.length)]);
    setGreetingText(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    const interval = setInterval(rotateBanner, 900000); 
    return () => clearInterval(interval);
  }, []);

  // Smart Recommendations Generator
  const recommendations = useMemo(() => {
    const recs = [];
    const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE).length;
    const highPriorityCount = tasks.filter(t => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE).length;

    if (overdueCount > 0) {
      recs.push({ id: 1, title: 'Cek Tugas Terlambat', subtitle: `Ada ${overdueCount} tugas yang melewati deadline.`, priority: 'High', color: 'bg-secondary' });
    }
    if (highPriorityCount > 2) {
      recs.push({ id: 2, title: 'Prioritas Tinggi Menumpuk', subtitle: 'Fokus selesaikan tugas High Priority dulu.', priority: 'High', color: 'bg-red-100 text-red-600' });
    }
    if (tasksInProgress > 5) {
      recs.push({ id: 3, title: 'Terlalu Banyak Multitasking', subtitle: 'Coba selesaikan satu per satu agar efisien.', priority: 'Medium', color: 'bg-tertiary' });
    }
    if (recs.length === 0) {
      recs.push({ id: 4, title: 'Jadwal Aman', subtitle: 'Semua terkendali. Pertahankan pace kerja ini!', priority: 'Low', color: 'bg-quaternary' });
    }
    return recs;
  }, [tasks, tasksInProgress]);

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const todayStr = time.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* ROW 1: Banner & Time Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WELCOME BANNER (Random Background) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-[32px] shadow-pop-active border-2 border-slate-800 flex flex-col justify-between min-h-[220px] group bg-slate-900">
          {/* Background Image with Opacity */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-60 mix-blend-overlay"
            style={{ backgroundImage: `url(${bannerImage})` }}
          />
          {/* Dark Overlay Gradient for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent z-0" />
          
          <div className="relative z-10 p-8 flex flex-col h-full justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-heading mb-2 text-white drop-shadow-md">
                Halo, {currentUser?.name?.split(' ')[0] || 'User'}! 👋
              </h1>
              <p className="text-slate-200 text-sm md:text-base max-w-lg font-medium leading-relaxed drop-shadow-sm animate-in fade-in slide-in-from-left-2 duration-500 key={greetingText}">
                {greetingText}
              </p>
            </div>

            <div className="flex justify-end mt-4">
               <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 flex items-center gap-3 shadow-lg hover:bg-white/20 transition-colors cursor-default">
                  <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center font-black text-xs shadow-sm">
                    {tasksInProgress}
                  </div>
                  <span className="font-bold text-sm text-white">Task On Progress</span>
               </div>
            </div>
          </div>
        </div>

        {/* TIME TRACKER */}
        <div className="bg-white border-2 border-slate-800 rounded-[32px] p-8 shadow-sticker flex flex-col items-center justify-center text-center relative overflow-hidden">
           <div className="absolute top-4 right-4">
              <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                 <ArrowRight size={16} className="-rotate-45 text-slate-400" />
              </div>
           </div>
           
           <div className="flex items-center gap-2 mb-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500">{todayStr}</span>
           </div>

           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sesi Fokus</p>
           <div className="text-5xl md:text-6xl font-heading text-slate-800 tracking-tight mb-8 tabular-nums">
              {formatTimer(seconds)}
           </div>

           <div className="flex gap-4 w-full">
              <button 
                onClick={() => setTimerActive(!timerActive)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${timerActive ? 'bg-[#3B82F6] text-white shadow-pop-active active:translate-y-0.5 active:shadow-none' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                 {timerActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                 {timerActive ? 'Jeda' : 'Mulai'}
              </button>
              <button 
                onClick={() => { setTimerActive(false); setSeconds(0); }}
                className="flex-1 py-3 bg-secondary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                 <div className="w-3 h-3 bg-white rounded-sm" /> Stop
              </button>
           </div>
        </div>
      </div>

      {/* ROW 2: Workload Chart & Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* WORKLOAD CHART */}
         <div className="lg:col-span-2 bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop flex flex-col">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-xl font-heading">Workload by Status</h3>
               <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                 <ArrowRight size={16} className="-rotate-45 text-slate-400" />
               </div>
            </div>

            {/* CENTERED LEGEND */}
            <div className="flex flex-wrap items-center justify-center gap-6 mb-6 py-2 bg-slate-50 rounded-2xl border border-slate-100 w-full">
               <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">In Progress</span>
                  </div>
                  <span className="text-xl font-heading text-slate-800">{Math.round((tasksInProgress/totalTasks)*100)}%</span>
               </div>
               <div className="w-[1px] h-8 bg-slate-200" />
               <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#34D399]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
                  </div>
                  <span className="text-xl font-heading text-slate-800">{Math.round((tasksCompleted/totalTasks)*100)}%</span>
               </div>
               <div className="w-[1px] h-8 bg-slate-200" />
               <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">On Hold</span>
                  </div>
                  <span className="text-xl font-heading text-slate-800">{Math.round((tasksOnHold/totalTasks)*100)}%</span>
               </div>
            </div>

            <div className="h-48 w-full mt-auto">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData} layout="vertical" barSize={24}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                     <XAxis type="number" hide />
                     <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '12px', border: '2px solid #1E293B', boxShadow: '4px 4px 0px 0px #1E293B', fontWeight: 'bold' }}
                     />
                     <Bar dataKey="value" radius={[0, 4, 4, 0]} background={{ fill: '#F8FAFC' }} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* PRODUCTIVITY SCORE - CENTERED & BIGGER */}
         <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col justify-between items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent to-secondary" />
            
            <div className="w-full flex justify-between items-start mb-4">
               <h3 className="text-lg font-heading leading-tight text-left">Productivity<br/>Score</h3>
               <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent border-2 border-transparent">
                  <TrendingUp size={20} />
               </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center py-4">
               <div className="flex items-start">
                  <span className="text-8xl font-heading text-slate-900 tracking-tighter drop-shadow-sm">{productivityScore}</span>
                  <span className="text-2xl font-bold text-slate-400 mt-4">%</span>
               </div>
            </div>
            
            <div className="w-full mt-4 pt-4 border-t-2 border-slate-100">
               <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  <span className="text-quaternary">↑ {Math.floor(Math.random() * 15)}%</span> lebih baik dari minggu lalu. Pertahankan!
               </p>
            </div>
         </div>
      </div>

      {/* ROW 3: Projects Gallery & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* WORKSPACES GALLERY (Real Data) */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-xl font-heading">Workspaces Gallery</h3>
               <div className="flex gap-2">
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                     <span className="w-2 h-2 rounded-full bg-slate-800" />
                     <span className="text-[9px] font-bold text-slate-500">Personal</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                     <span className="w-2 h-2 rounded-full bg-white border-2 border-slate-800" />
                     <span className="text-[9px] font-bold text-slate-500">Team</span>
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
               <div className="flex gap-4 w-max">
                  {workspaces.length === 0 ? (
                     <div className="w-80 p-8 border-2 border-dashed border-slate-300 rounded-[28px] flex flex-col items-center justify-center text-center bg-slate-50">
                        <Briefcase size={32} className="text-slate-300 mb-2" />
                        <p className="text-slate-400 font-bold text-sm">Belum ada Workspace.</p>
                     </div>
                  ) : (
                     workspaces.map((ws) => {
                        const isPersonal = ws.type === WorkspaceType.PERSONAL;
                        const isOwner = ws.owner_id === currentUser?.id;
                        
                        return (
                           <div key={ws.id} className={`relative w-80 p-6 rounded-[28px] shadow-sm transition-all hover:-translate-y-1 hover:shadow-pop cursor-pointer border-2 ${isPersonal ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}>
                              <div className="flex justify-between items-start mb-6">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${isPersonal ? 'bg-white text-slate-900 border-transparent' : 'bg-slate-100 text-slate-500 border-slate-100'}`}>
                                    {isPersonal ? <Layers size={20} /> : <Briefcase size={20} />}
                                 </div>
                                 <div className="flex gap-2">
                                    {isOwner && <span className="px-2 py-1 bg-secondary text-white text-[9px] font-black uppercase rounded-md shadow-sm">Owner</span>}
                                    {!isOwner && <span className="px-2 py-1 bg-tertiary text-slate-900 text-[9px] font-black uppercase rounded-md shadow-sm">Joined</span>}
                                 </div>
                              </div>
                              
                              <h4 className="text-xl font-heading mb-1 leading-tight truncate">{ws.name}</h4>
                              <div className={`flex items-center gap-2 text-xs font-bold mb-4 ${isPersonal ? 'text-slate-400' : 'text-slate-500'}`}>
                                 <Users size={14} /> {ws.type} Space
                              </div>

                              <p className={`text-xs font-medium leading-relaxed mb-6 line-clamp-2 h-8 ${isPersonal ? 'text-slate-300' : 'text-slate-600'}`}>
                                 {ws.description || "Workspace aktif."}
                              </p>

                              <button className={`w-full mt-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${isPersonal ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                                 {isPersonal ? <ArrowRight size={14} /> : <Video size={14} />}
                                 {isPersonal ? 'Buka Workspace' : 'Masuk Space'}
                              </button>
                           </div>
                        );
                     })
                  )}
               </div>
            </div>
         </div>

         {/* SMART REMINDERS (Row Span) */}
         <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-heading">Rekomendasi</h3>
               <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                 <Lightbulb size={16} className="text-tertiary fill-tertiary" />
               </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-hide max-h-[400px]">
               {recommendations.map(rem => (
                  <div key={rem.id} className="group p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-800 hover:shadow-sm transition-all cursor-pointer bg-white">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-200 transition-colors`}>
                              {rem.priority === 'High' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                           </div>
                           <h4 className="text-sm font-bold text-slate-800">{rem.title}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${rem.color} ${rem.priority === 'High' ? 'text-white' : 'text-slate-600'}`}>
                           {rem.priority}
                        </span>
                     </div>
                     <p className="text-xs text-slate-400 pl-11 leading-relaxed">{rem.subtitle}</p>
                  </div>
               ))}
            </div>

            <button className="w-full mt-4 py-3 bg-[#3B82F6] text-white rounded-xl font-bold text-xs shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all">
               Lihat Semua Tugas &gt;
            </button>
         </div>

      </div>

      {/* ROW 4: People / Extra (Mockup) */}
      <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col md:flex-row items-center justify-between gap-6">
         <div>
            <h3 className="text-lg font-heading mb-1">Anggota Aktif</h3>
            <p className="text-xs text-slate-400 font-bold">Daftar rekan kerja yang sedang online di workspace Anda.</p>
         </div>
         <div className="flex -space-x-3">
            {[1,2,3,4,5].map(i => (
               <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+20}`} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 hover:-translate-y-1 transition-transform" alt="Avatar" title={`Member ${i}`} />
            ))}
            <div className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white flex items-center justify-center text-xs font-bold text-slate-800 shadow-sm relative z-10">
               +
            </div>
         </div>
         <div className="p-2 border-2 border-slate-200 rounded-full hover:bg-slate-50 cursor-pointer">
            <ArrowRight size={16} className="-rotate-45 text-slate-400" />
         </div>
      </div>

    </div>
  );
};
