import { useState, useCallback } from 'react';
import { Toast } from './Toast';

export interface ToastItem {
  id: string;
  message: string;
  duration?: number;
}

export const useToastContainer = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const ToastContainer = useCallback(() => {
    return (
      <>
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              top: `${1 + index * 6}rem`, // Stack toasts vertically
            }}
            className="fixed right-4 z-50"
          >
            <Toast
              message={toast.message}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </>
    );
  }, [toasts, removeToast]);

  return {
    showToast,
    ToastContainer,
  };
};
