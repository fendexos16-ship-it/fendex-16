
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        className={`
          w-full px-3 py-2.5 
          bg-white border rounded-md shadow-sm 
          text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600
          transition-colors duration-200
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
