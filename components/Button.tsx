
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  isLoading, 
  variant = 'primary', 
  className = '', 
  disabled, 
  ...props 
}) => {
  const baseStyles = "w-full flex justify-center items-center py-2.5 px-4 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "border-transparent text-white bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 shadow-sm",
    secondary: "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-brand-500",
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-sm"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
          Processing...
        </>
      ) : children}
    </button>
  );
};
