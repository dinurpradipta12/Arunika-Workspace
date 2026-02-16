import React, { useState, useRef, useEffect } from 'react';
import { EventCard } from './EventCard';
import { EventPopup } from './EventPopup';
import { CalendarEvent } from '../../types'; // Import from global types

interface WeeklyCalendarProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventUpdate: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 80;

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  currentDate,
  events,
  onEventUpdate,
  onEventDelete,
  onEditEvent
}) => {
  // --- STATE ---
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // DnD & Resize State
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [resizingEvent, setResizingEvent] = useState<CalendarEvent | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Current Time Indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(i);
  }, []);

  // Calculate current time position in px
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTop = (currentMinutes / 60) * HOUR_HEIGHT;

  // --- DATE HELPERS ---
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(start.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const weekDays = getWeekDays(currentDate);

  // --- POPUP LOGIC ---
  const handleEventHover = (e: React.MouseEvent, event: CalendarEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    // Calculate safe position
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupPos({ top: rect.top, left: rect.right + 10 });
    setHoveredEvent(event);
  };

  const handleEventLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 150); // 150ms delay
  };

  const keepPopupOpen = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  // --- DRAG TO MOVE LOGIC ---
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (!draggedEvent || !calendarRef.current) return;

    // Calculate Y relative to the day column top (requires careful offset calc)
    // Using simple offset relative to the target element (the day column)
    const relY = e.nativeEvent.offsetY; 
    
    // Snap to 15 mins
    const pixelsPerMinute = HOUR_HEIGHT / 60;
    const totalMinutes = relY / pixelsPerMinute;
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    
    const newStart = new Date(date);
    newStart.setHours(0, snappedMinutes, 0, 0);
    
    // Maintain duration
    const originalStart = new Date(draggedEvent.start);
    const originalEnd = new Date(draggedEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();
    
    const newEnd = new Date(newStart.getTime() + duration);

    onEventUpdate({
      ...draggedEvent,
      start: newStart.toISOString(),
      end: newEnd.toISOString()
    });
    
    setDraggedEvent(null);
  };

  // --- RESIZE LOGIC ---
  const handleResizeStart = (e: React.MouseEvent, event: CalendarEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingEvent(event);
    
    const startY = e.clientY;
    const startEnd = new Date(event.end).getTime();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const pixelsPerMinute = HOUR_HEIGHT / 60;
      const deltaMinutes = deltaY / pixelsPerMinute;
      
      // Snap to 15 mins
      const newEndTime = startEnd + deltaMinutes * 60 * 1000;
      const snappedEndTime = Math.round(newEndTime / (15 * 60 * 1000)) * (15 * 60 * 1000);
      
      // Min duration 15 mins
      const startTime = new Date(event.start).getTime();
      if (snappedEndTime - startTime >= 15 * 60 * 1000) {
         // Optimistic UI update could happen here
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
        const deltaY = upEvent.clientY - startY;
        const pixelsPerMinute = HOUR_HEIGHT / 60;
        const deltaMinutes = deltaY / pixelsPerMinute;
        const newEndTime = startEnd + deltaMinutes * 60 * 1000;
        const snappedEndTime = Math.round(newEndTime / (15 * 60 * 1000)) * (15 * 60 * 1000);
        
        if (snappedEndTime - new Date(event.start).getTime() >= 15 * 60 * 1000) {
            onEventUpdate({
                ...event,
                end: new Date(snappedEndTime).toISOString()
            });
        }
        
        setResizingEvent(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white relative h-full" ref={calendarRef}>
      <EventPopup 
        event={hoveredEvent} 
        position={popupPos} 
        onClose={() => setHoveredEvent(null)}
        onMouseEnter={keepPopupOpen}
        onMouseLeave={handleEventLeave}
        onEdit={(ev) => onEditEvent?.(ev)}
        onDelete={onEventDelete}
      />

      {/* FIXED HEADER (DAYS) */}
      <div className="flex border-b border-slate-100 shrink-0 bg-white z-30">
        {/* Time Col Spacer (Sticky Left) */}
        <div className="w-20 border-r border-slate-100 flex items-center justify-center bg-white sticky left-0 z-40 shadow-[4px_0px_10px_rgba(0,0,0,0.02)]">
           <span className="text-[10px] font-black text-slate-400">GMT+7</span>
        </div>
        
        {/* Days Header */}
        <div className="flex-1 grid grid-cols-7 min-w-[800px]">
           {weekDays.map((date, idx) => {
              const isToday = date.toDateString() === now.toDateString();
              return (
                <div key={idx} className={`py-3 text-center border-r border-slate-100 transition-colors ${isToday ? 'bg-orange-100/50' : ''}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-orange-600' : 'text-slate-400'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${isToday ? 'bg-orange-500 text-white shadow-pop' : 'text-slate-800'}`}>
                    {date.getDate()}
                  </div>
                </div>
              )
           })}
        </div>
      </div>

      {/* SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative">
        <div className="flex relative">
            {/* TIME COLUMN (Sticky Left) */}
            <div className="w-20 shrink-0 border-r border-slate-100 bg-white z-20 sticky left-0 shadow-[4px_0px_10px_rgba(0,0,0,0.02)]">
               {HOURS.map(h => (
                 <div key={h} className="relative border-b border-transparent box-border" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="absolute -top-2 right-2 text-xs font-bold text-slate-400">
                      {h.toString().padStart(2, '0')}:00
                    </span>
                 </div>
               ))}
            </div>

            {/* EVENT GRID */}
            <div className="flex-1 grid grid-cols-7 min-w-[800px] relative">
               
               {/* Global Background Lines */}
               <div className="absolute inset-0 pointer-events-none z-0">
                  {HOURS.map(h => (
                     <div key={`line-${h}`} className="border-b border-slate-100 w-full" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}
               </div>

               {/* Current Time Line Overlay (Across entire container, absolute to row) */}
               {/* Note: Placing it here makes it span the scrollable grid width */}
               <div 
                 className="absolute left-0 right-0 border-t-2 border-dashed border-orange-500 z-10 pointer-events-none flex items-center"
                 style={{ top: `${currentTop}px` }}
               >
                 {/* Dot positioned relative to grid start, visually bridging time col */}
                 <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
               </div>

               {/* Day Columns */}
               {weekDays.map((date, idx) => {
                  const isToday = date.toDateString() === now.toDateString();
                  const dateEvents = events.filter(e => {
                      const eDate = new Date(e.start);
                      return eDate.getDate() === date.getDate() && eDate.getMonth() === date.getMonth();
                  });

                  return (
                    <div 
                      key={idx} 
                      className={`relative border-r border-slate-100 group ${isToday ? 'bg-orange-50/40' : ''}`}
                      style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date)}
                    >
                       {/* Drop Zone */}
                       {dateEvents.map(ev => (
                         <EventCard 
                           key={ev.id} 
                           event={ev} 
                           hourHeight={HOUR_HEIGHT}
                           onHover={handleEventHover}
                           onLeave={handleEventLeave}
                           onDragStart={handleDragStart}
                           onResizeStart={handleResizeStart}
                         />
                       ))}
                    </div>
                  );
               })}
            </div>
        </div>
      </div>
    </div>
  );
};