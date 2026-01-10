
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000); // 3 Seconds
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (msg: string) => addToast(msg, 'success');
  const error = (msg: string) => addToast(msg, 'error');
  const info = (msg: string) => addToast(msg, 'info');

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              flex items-center w-full max-w-xs p-4 rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 border-l-4 transition-all transform animate-fade-in-down
              ${t.type === 'success' ? 'bg-white border-green-500' : 
                t.type === 'error' ? 'bg-white border-red-500' : 
                'bg-white border-blue-500'}
            `}
            role="alert"
          >
            <div className={`
              inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg
              ${t.type === 'success' ? 'text-green-500 bg-green-100' : 
                t.type === 'error' ? 'text-red-500 bg-red-100' : 
                'text-blue-500 bg-blue-100'}
            `}>
              {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {t.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div className="ml-3 text-sm font-normal text-gray-800">{t.message}</div>
            <button
              type="button"
              className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8"
              onClick={() => removeToast(t.id)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
