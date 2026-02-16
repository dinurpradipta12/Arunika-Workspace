
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Edit2, Trash2, Clock } from 'lucide-react';
import { CalendarEvent } from '../../types'; 

interface EventPopupProps {
  event: CalendarEvent | null;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const EventPopup: React.FC<EventPopupProps> = ({
  event,
  position,
  onClose,
  onEdit,
  onDelete,
  onMouseEnter,
  onMouseLeave
}) => {
  if (!event || !position) return null;

  // Determine if popup should open to the left (if near right edge)
  const isNearRightEdge = position.left > window.innerWidth - 350;
  const adjustedLeft = isNearRightEdge ? position.left - 340 : position.left + 20;
  
  // Format dates
  const dateStr = new Date(event.start).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }).toUpperCase();
  const timeRange = `${new Date(event.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(event.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="fixed z-50 w-[320px] bg-white rounded-2xl shadow-xl border-2 border-slate-100 overflow-hidden"
          style={{ 
            top: Math.min(position.top, window.innerHeight - 300), // Prevent bottom overflow
            left: adjustedLeft
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Header Color Strip */}
          <div className="h-2 w-full" style={{ backgroundColor: event.color }} />

          <div className="p-5 space-y-4">
            {/* Top Section */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">
                    {dateStr}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> {timeRange}
                  </span>
                </div>
                <h3 className="text-lg font-heading text-slate-900 leading-tight">
                  {event.title}
                </h3>
              </div>
              <button className="text-slate-300 hover:text-slate-600 transition-colors">
                <Share2 size={16} />
              </button>
            </div>

            {/* Participants */}
            {event.participants && event.participants.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {event.participants.map((user, idx) => (
                    <img 
                      key={idx}
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${idx}`}
                      className="w-6 h-6 rounded-full border-2 border-white bg-slate-100"
                      alt={user.name}
                      title={user.name}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {event.participants.length} Participant{event.participants.length > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Notes */}
            {event.notes && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {event.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-2">
              <button 
                onClick={() => onEdit(event)}
                className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button 
                onClick={() => onDelete(event.id)}
                className="flex-1 py-2 rounded-lg bg-white border border-red-100 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
