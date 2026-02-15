
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  Play, 
  Pause, 
  Calendar, 
  MoreHorizontal, 
  Video, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare,
  TrendingUp,
  Layout,
  Briefcase
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

// Mock Data for Charts
const workloadData = [
  { name: 'Mon', progress: 40, completed: 24, hold: 10 },
  { name: 'Tue', progress: 30, completed: 13, hold: 5 },
  { name: 'Wed', progress: 20, completed: 58, hold: 0 },
  { name: 'Thu', progress: 27, completed: 39, hold: 8 },
  { name: 'Fri', progress: 18, completed: 48, hold: 2 },
];

const reminders = [
  { id: 1, title: 'Check Daily Progress', subtitle: 'Review tasks and updates daily', priority: 'Low', color: 'bg-quaternary' },
  { id: 2, title: 'Provide Feedback Tasks', subtitle: 'Comments for task improvements', priority: 'High', color: 'bg-secondary' },
  { id: 3, title: 'Set Tomorrow\'s Goals', subtitle: 'Plan priorities for next day', priority: 'Medium', color: 'bg-tertiary' },
  { id: 4, title: 'Update Project Deadlines', subtitle: 'Adjust timelines for team A', priority: 'High', color: 'bg-secondary' },
];

const projects = [
  { 
    id: 1, 
    title: 'Client Consultation Calls', 
    time: '08:00 am - 09:00 am', 
    desc: 'Discuss new projects, gather client requirements.',
    icon: <Video size={20} />,
    color: 'bg-slate-900 text-white',
    subtasks: ['Prepare Meeting Agenda', 'Document Requirements']
  },
  { 
    id: 2, 
    title: 'Project Management Check-in', 
    time: '09:30 am - 10:30 am', 
    desc: 'Weekly sync with the development team.',
    icon: <Layout size={20} />,
    color: 'bg-white text-slate-900 border-2 border-slate-200',
    subtasks: []
  },
  { 
    id: 3, 
    title: 'Design Research & Explore', 
    time: '11:00 am - 12:30 pm', 
    desc: 'Explore new design trends for 2025.',
    icon: <Briefcase size={20} />,
    color: 'bg-white text-slate-900 border-2 border-slate-200',
    subtasks: []
  }
];

export const Dashboard: React.FC = () => {
  // Timer Logic
  const [time, setTime] = useState(new Date());
  const [timerActive, setTimerActive] = useState(true);
  const [seconds, setSeconds] = useState(11770); // Start from arbitrary seconds (3h 16m 10s)

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

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const todayStr = time.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* ROW 1: Banner & Time Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WELCOME BANNER */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white p-8 shadow-pop-active border-2 border-slate-800 flex flex-col justify-between min-h-[200px]">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl translate-y-1/2" />
          
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-heading mb-3 drop-shadow-sm">Hi, TaskPlayer! 🔮</h1>
            <p className="text-blue-100 text-sm md:text-base max-w-md font-medium leading-relaxed">
              Please review your tasks and provide feedback for today's project management dashboard.
            </p>
          </div>

          <div className="relative z-10 flex justify-end mt-4">
             <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-5 py-2 flex items-center gap-3 shadow-lg">
                <div className="w-8 h-8 bg-white text-[#3B82F6] rounded-full flex items-center justify-center font-black text-xs">2</div>
                <span className="font-bold text-sm">Task On Progress</span>
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

           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current Session</p>
           <div className="text-5xl md:text-6xl font-heading text-slate-800 tracking-tight mb-8 tabular-nums">
              {formatTimer(seconds)}
           </div>

           <div className="flex gap-4 w-full">
              <button 
                onClick={() => setTimerActive(!timerActive)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${timerActive ? 'bg-[#3B82F6] text-white shadow-pop-active active:translate-y-0.5 active:shadow-none' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                 {timerActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                 {timerActive ? 'Pause' : 'Resume'}
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
         <div className="lg:col-span-2 bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-heading">Workload by Status</h3>
               <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                 <ArrowRight size={16} className="-rotate-45 text-slate-400" />
               </div>
            </div>

            <div className="flex gap-6 mb-6">
               <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">In Progress</span>
                  </div>
                  <span className="text-2xl font-heading">24%</span>
               </div>
               <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#34D399]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
                  </div>
                  <span className="text-2xl font-heading">46%</span>
               </div>
               <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">On Hold</span>
                  </div>
                  <span className="text-2xl font-heading">12%</span>
               </div>
            </div>

            <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData} barGap={4}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                     <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 700 }} 
                        dy={10}
                     />
                     <Tooltip 
                        cursor={{ fill: '#F1F5F9', radius: 8 }}
                        contentStyle={{ borderRadius: '12px', border: '2px solid #1E293B', boxShadow: '4px 4px 0px 0px #1E293B', fontWeight: 'bold' }}
                     />
                     <Bar dataKey="progress" fill="#3B82F6" radius={[4, 4, 4, 4]} barSize={12} />
                     <Bar dataKey="completed" fill="#34D399" radius={[4, 4, 4, 4]} barSize={12} />
                     <Bar dataKey="hold" fill="#FBBF24" radius={[4, 4, 4, 4]} barSize={12} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* PRODUCTIVITY SCORE */}
         <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <h3 className="text-lg font-heading leading-tight">Productivity<br/>Score</h3>
               <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent border-2 border-transparent">
                  <TrendingUp size={20} />
               </div>
            </div>
            
            <div className="flex items-end gap-2 mt-4">
               <span className="text-6xl font-heading text-slate-900 tracking-tighter">84</span>
               <span className="text-xl font-bold text-slate-400 mb-2">%</span>
            </div>
            
            <div className="mt-4 pt-4 border-t-2 border-slate-100">
               <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  <span className="text-quaternary">↑ 12%</span> better than last week. Keep it up!
               </p>
            </div>
         </div>
      </div>

      {/* ROW 3: Projects Gallery & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* PROJECTS / WORKSPACES GALLERY (Span 2) */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-xl font-heading">Projects Workspace</h3>
               <div className="flex gap-2">
                  <Button variant="ghost" className="text-xs h-8 px-3">Weekly <ArrowRight size={12} className="ml-1 rotate-90" /></Button>
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><Layout size={18} /></button>
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><MoreHorizontal size={18} /></button>
               </div>
            </div>

            <div className="overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
               <div className="flex gap-4 w-max">
                  {/* Card 1: Active */}
                  {projects.map((proj) => (
                     <div key={proj.id} className={`w-80 p-6 rounded-[28px] shadow-sm transition-all hover:-translate-y-1 hover:shadow-pop cursor-pointer border-2 ${proj.color.includes('bg-slate-900') ? 'border-slate-800' : 'border-slate-200'} ${proj.color}`}>
                        <div className="flex justify-between items-start mb-6">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${proj.color.includes('bg-slate-900') ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-500'}`}>
                              {proj.icon}
                           </div>
                           <button className="p-1 hover:bg-white/20 rounded-full transition-colors"><MoreHorizontal size={20} /></button>
                        </div>
                        
                        <h4 className="text-xl font-heading mb-1 leading-tight">{proj.title}</h4>
                        <div className={`flex items-center gap-2 text-xs font-bold mb-4 ${proj.color.includes('bg-slate-900') ? 'text-slate-400' : 'text-slate-500'}`}>
                           <Clock size={14} /> {proj.time}
                        </div>

                        <div className="flex gap-2 mb-4">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${proj.color.includes('bg-slate-900') ? 'bg-[#3B82F6] text-white' : 'bg-slate-100 text-slate-600'}`}>Desc</span>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${proj.color.includes('bg-slate-900') ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border border-slate-200'}`}>People</span>
                        </div>

                        <p className={`text-xs font-medium leading-relaxed mb-6 ${proj.color.includes('bg-slate-900') ? 'text-slate-300' : 'text-slate-600'}`}>
                           {proj.desc}
                        </p>

                        {/* Checklist Preview */}
                        {proj.subtasks.length > 0 && (
                           <div className="space-y-2">
                              {proj.subtasks.map((st, idx) => (
                                 <div key={idx} className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${proj.color.includes('bg-slate-900') ? 'border-slate-600' : 'border-slate-300'}`} />
                                    <span className={`text-xs ${proj.color.includes('bg-slate-900') ? 'text-slate-400' : 'text-slate-500'}`}>{st}</span>
                                 </div>
                              ))}
                           </div>
                        )}

                        {/* Join/Enter Button */}
                        <button className={`w-full mt-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${proj.color.includes('bg-slate-900') ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                           {proj.color.includes('bg-slate-900') ? <Video size={14} /> : <ArrowRight size={14} />}
                           {proj.color.includes('bg-slate-900') ? 'Go to meeting room' : 'View Project'}
                        </button>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* REMINDERS LIST (Row Span) */}
         <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-heading">Reminders</h3>
               <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                 <ArrowRight size={16} className="-rotate-45 text-slate-400" />
               </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-hide max-h-[400px]">
               {reminders.map(rem => (
                  <div key={rem.id} className="group p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-800 hover:shadow-sm transition-all cursor-pointer bg-white">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-200 transition-colors`}>
                              {rem.id === 1 ? <Calendar size={16} /> : rem.id === 2 ? <MessageSquare size={16} /> : rem.id === 3 ? <Clock size={16} /> : <AlertTriangle size={16} />}
                           </div>
                           <h4 className="text-sm font-bold text-slate-800">{rem.title}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${rem.priority === 'High' ? 'bg-red-100 text-red-500' : rem.priority === 'Medium' ? 'bg-orange-100 text-orange-500' : 'bg-green-100 text-green-500'}`}>
                           • {rem.priority}
                        </span>
                     </div>
                     <p className="text-xs text-slate-400 pl-11">{rem.subtitle}</p>
                  </div>
               ))}
            </div>

            <button className="w-full mt-4 py-3 bg-[#3B82F6] text-white rounded-xl font-bold text-xs shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all">
               See All Reminders &gt;
            </button>
         </div>

      </div>

      {/* ROW 4: People / Extra */}
      <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col md:flex-row items-center justify-between gap-6">
         <div>
            <h3 className="text-lg font-heading mb-1">Company Jobs Level</h3>
            <p className="text-xs text-slate-400 font-bold">Review employee hierarchy and active workspace members.</p>
         </div>
         <div className="flex -space-x-3">
            {[1,2,3,4,5].map(i => (
               <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+20}`} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100" alt="Avatar" />
            ))}
            <div className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white flex items-center justify-center text-xs font-bold text-slate-800 shadow-sm relative z-10">
               +12
            </div>
         </div>
         <div className="p-2 border-2 border-slate-200 rounded-full hover:bg-slate-50 cursor-pointer">
            <ArrowRight size={16} className="-rotate-45 text-slate-400" />
         </div>
      </div>

    </div>
  );
};
