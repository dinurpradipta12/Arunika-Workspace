
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  isTextArea?: boolean;
  // Added icon prop to support decorative icons inside the input field
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, isTextArea, icon, className = '', ...props }) => {
  const baseStyles = "w-full p-3 bg-white border-2 border-slate-200 rounded-lg text-foreground placeholder:text-mutedForeground focus:border-accent focus:shadow-pop transition-all outline-none font-medium";
  
  // Helper to render either input or textarea with common logic for icon padding
  const renderField = () => {
    const fieldClassName = `${baseStyles} ${icon ? 'pl-10' : ''} ${className}`;
    
    if (isTextArea) {
      return (
        <textarea 
          className={`${fieldClassName} min-h-[100px] resize-none`} 
          {...(props as any)} 
        />
      );
    }
    
    return <input className={fieldClassName} {...props} />;
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>}
      {icon ? (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedForeground pointer-events-none z-10 flex items-center justify-center">
            {icon}
          </div>
          {renderField()}
        </div>
      ) : (
        renderField()
      )}
    </div>
  );
};
