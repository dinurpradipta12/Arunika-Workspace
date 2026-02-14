
import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  showArrow?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  showArrow = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "px-6 py-3 rounded-full font-bold flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-slate-800";
  
  const variants = {
    primary: "bg-accent text-white shadow-pop hover:shadow-pop-hover hover:-translate-y-1 active:shadow-pop-active active:translate-y-0",
    secondary: "bg-transparent text-foreground hover:bg-tertiary",
    ghost: "border-none px-4 py-2 hover:bg-muted"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
      {showArrow && (
        <span className="ml-2 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
          <ArrowRight size={16} strokeWidth={3} />
        </span>
      )}
    </button>
  );
};
