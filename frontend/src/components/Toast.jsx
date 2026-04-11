import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return { toasts, show };
}

const TYPE_CLS = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-blue-600 text-white',
};

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in-up ${TYPE_CLS[t.type] || TYPE_CLS.success}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
