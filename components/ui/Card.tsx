
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  variant?: 'white' | 'accent' | 'secondary' | 'tertiary';
  className?: string;
  isHoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  title, 
  icon, 
  variant = 'white', 
  className = '',
  isHoverable = true 
}) => {
  const bgColors = {
    white: 'bg-white',
    accent: 'bg-accent text-white',
    secondary: 'bg-secondary text-white',
    tertiary: 'bg-tertiary text-foreground',
  };

  return (
    <div className={`
      relative p-6 border-2 border-slate-800 rounded-xl shadow-sticker 
      ${bgColors[variant]} 
      ${isHoverable ? 'hover:-rotate-1 hover:scale-[1.02] transition-all duration-300' : ''}
      ${className}
    `}>
      {icon && (
        <div className="absolute -top-6 left-6 w-12 h-12 rounded-full border-2 border-slate-800 bg-white flex items-center justify-center text-slate-800 z-10 shadow-sm">
          {icon}
        </div>
      )}
      {title && (
        <h3 className={`text-xl font-heading mb-4 ${icon ? 'mt-4' : ''}`}>
          {title}
        </h3>
      )}
      <div className="relative">
        {children}
      </div>
    </div>
  );
};
