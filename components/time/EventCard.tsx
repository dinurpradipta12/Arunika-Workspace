
import React from 'react';
import { CalendarEvent } from '../../types';

interface EventCardProps {
  event: CalendarEvent;
  hourHeight: number;
  onHover: (e: React.MouseEvent, event: CalendarEvent) => void;
  onLeave: () => void;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onResizeStart: (e: React.MouseEvent, event: CalendarEvent) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  hourHeight,
  onHover,
  onLeave,
  onDragStart,
  onResizeStart
}) => {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  // Calculate Position
  const startHour = startDate.getHours();
  const startMinutes = startDate.getMinutes();
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  
  const pixelsPerMinute = hourHeight / 60;
  const top = (startHour * 60 + startMinutes) * pixelsPerMinute;
  const height = Math.max(durationMinutes * pixelsPerMinute, 24); // Min height

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, event)}
      onMouseEnter={(e) => onHover(e, event)}
      onMouseLeave={onLeave}
      className="absolute left-1 right-1 rounded-lg border-l-4 p-1.5 cursor-grab active:cursor-grabbing hover:z-20 transition-all hover:shadow-lg group overflow-hidden select-none"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: `${event.color}20`, // 20% opacity
        borderColor: event.color,
        borderLeftColor: event.color,
      }}
    >
      <div className="flex flex-col h-full pointer-events-none">
        <span className="text-[9px] font-bold text-slate-500 leading-none mb-0.5">
          {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-[10px] font-black text-slate-800 leading-tight truncate">
          {event.title}
        </span>
        
        {/* Resize Handle */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/5 pointer-events-auto"
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, event);
          }}
        />
      </div>
    </div>
  );
};
