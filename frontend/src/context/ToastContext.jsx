/* eslint-disable react-refresh/only-export-components -- hook + provider pair */
import { createContext, useContext, useMemo } from 'react';
import { useToastState, ToastContainer } from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { toasts, show } = useToastState();
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
