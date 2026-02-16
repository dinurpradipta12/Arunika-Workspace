import React, { useState, useMemo } from 'react';
import { CalendarHeader } from './time/CalendarHeader';
import { WeeklyCalendar } from './time/WeeklyCalendar';
import { Task, TaskStatus, CalendarEvent } from '../types';

interface TimeTrackingViewProps {
  tasks: Task[];
  googleEvents: Task[];
  currentUser: any;
  onEditTask: (task: Task) => void;
}

const COLORS = ['#8B5CF6', '#F472B6', '#FBBF24', '#34D399', '#38BDF8'];

export const TimeTrackingView: React.FC<TimeTrackingViewProps> = ({
  tasks,
  googleEvents,
  currentUser,
  onEditTask
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Combine & Transform Tasks to Calendar Events
  const events: CalendarEvent[] = useMemo(() => {
    const allTasks = [...tasks, ...googleEvents];
    
    return allTasks
      .filter(t => t.start_date && t.due_date && !t.is_archived)
      .map((t, idx) => ({
        id: t.id,
        title: t.title,
        start: t.start_date!,
        end: t.due_date!,
        color: COLORS[idx % COLORS.length],
        participants: currentUser ? [currentUser] : [], // Simplification
        notes: t.description || 'No description',
        originalTaskId: t.id
      }));
  }, [tasks, googleEvents, currentUser]);

  // --- Handlers ---
  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    console.log("Update Event (Time Tracking):", updatedEvent);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    // Find original task from ID or originalTaskId
    const originalTask = tasks.find(t => t.id === event.originalTaskId || t.id === event.id);
    if (originalTask) {
        onEditTask(originalTask);
    }
  };

  const handleEventDelete = (id: string) => {
    console.log("Delete Event:", id);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <CalendarHeader 
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <WeeklyCalendar 
          currentDate={currentDate}
          events={events}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          onEditEvent={handleEditEvent}
        />
      </div>
    </div>
  );
};