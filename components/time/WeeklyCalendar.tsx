
import React, { useState, useRef, useEffect } from 'react';
import { EventCard } from './EventCard';
import { EventPopup } from './EventPopup';
import { CalendarEvent } from '../../types'; // Import from global types

interface WeeklyCalendarProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventUpdate: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 80;

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  currentDate,
  events,
  onEventUpdate,
  onEventDelete
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

    const rect = calendarRef.current.getBoundingClientRect();
    // Calculate Y relative to the scrolling container
    // The drop target is the day column div, simpler vertical calculation from offset
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
    <div className="flex flex-1 overflow-hidden bg-white relative" ref={calendarRef}>
      <EventPopup 
        event={hoveredEvent} 
        position={popupPos} 
        onClose={() => setHoveredEvent(null)}
        onMouseEnter={keepPopupOpen}
        onMouseLeave={handleEventLeave}
        onEdit={(ev) => console.log('Edit', ev)}
        onDelete={onEventDelete}
      />

      {/* TIME SIDEBAR */}
      <div className="w-20 flex-shrink-0 border-r border-slate-100 bg-white overflow-hidden">
        <div className="h-10 border-b border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
          GMT+7
        </div>
        <div className="overflow-hidden">
           {HOURS.map(h => (
             <div key={h} className="relative border-b border-transparent box-border" style={{ height: `${HOUR_HEIGHT}px` }}>
                <span className="absolute -top-2 right-2 text-xs font-bold text-slate-400">
                  {h.toString().padStart(2, '0')}:00
                </span>
             </div>
           ))}
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative">
        <div className="grid grid-cols-7 min-w-[800px]">
          {weekDays.map((date, idx) => {
            const isToday = date.toDateString() === now.toDateString();
            const dateEvents = events.filter(e => {
                const eDate = new Date(e.start);
                return eDate.getDate() === date.getDate() && eDate.getMonth() === date.getMonth();
            });

            // Calculate current time position
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const currentTop = (currentMinutes / 60) * HOUR_HEIGHT;

            return (
              <div 
                key={idx} 
                className={`border-r border-slate-100 relative min-h-[${HOURS.length * HOUR_HEIGHT}px] group`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
              >
                {/* Header Day */}
                <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 py-3 text-center transition-colors ${isToday ? 'bg-accent/5' : ''}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-accent' : 'text-slate-400'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${isToday ? 'bg-accent text-white shadow-pop' : 'text-slate-800'}`}>
                    {date.getDate()}
                  </div>
                </div>

                {/* Hour Lines Background */}
                <div className="absolute inset-0 top-[60px] z-0 pointer-events-none">
                   {HOURS.map(h => (
                     <div key={`line-${h}`} className="border-b border-slate-50 w-full" style={{ height: `${HOUR_HEIGHT}px` }} />
                   ))}
                </div>

                {/* Current Time Line */}
                {isToday && (
                   <div 
                     className="absolute left-0 right-0 border-t-2 border-dashed border-orange-400 z-10 pointer-events-none flex items-center"
                     style={{ top: `${currentTop + 60}px` }}
                   >
                     <div className="w-2 h-2 rounded-full bg-orange-400 -ml-1" />
                   </div>
                )}

                {/* Drop Zone / Content Area */}
                <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
