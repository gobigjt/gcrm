/* eslint-disable react-refresh/only-export-components -- hook shares state with ToastContainer */
import { useCallback, useRef, useState } from 'react';

/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='success']
 * @param {null|{
 *   actions?: Array<{ label: string, variant?: 'secondary'|'danger'|'primary', onClick: () => void | Promise<void> }>,
 *   durationMs?: number | false,
 *   position?: 'bottom-right' | 'top-center'
 * }} [extra]
 */
/** Local toast stack (e.g. tests). Prefer `useToast` from `context/ToastContext` in the app. */
export function useToastState() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'success', extra = null) => {
    const id = ++idRef.current;
    const rawActions = extra?.actions;

    const wrappedActions = rawActions?.map((a) => ({
      label: a.label,
      variant: a.variant || 'secondary',
      onClick: async () => {
        try {
          await Promise.resolve(a.onClick());
        } finally {
          setToasts((cur) => cur.filter((x) => x.id !== id));
        }
      },
    }));

    setToasts((t) => [
      ...t,
      { id, message, type, actions: wrappedActions, position: extra?.position || 'bottom-right' },
    ]);

    if (!rawActions?.length) {
      const ms = extra?.durationMs ?? 3000;
      if (ms !== false) {
        setTimeout(() => {
          setToasts((cur) => cur.filter((x) => x.id !== id));
        }, ms);
      }
    } else if (extra?.durationMs && extra.durationMs !== false) {
      setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== id));
      }, extra.durationMs);
    }
  }, []);

  return { toasts, show };
}

const TYPE_CLS = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-600 text-white',
};

const BTN_CLS = {
  secondary:
    'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/30',
  primary:
    'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-amber-800 hover:bg-amber-50',
  danger:
    'px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-800 text-white border border-red-800',
};

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  const topCenter = toasts.filter((t) => t.position === 'top-center');
  const bottomRight = toasts.filter((t) => t.position !== 'top-center');
  const renderStack = (items, stackCls) => (
    <div className={stackCls}>
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in-up ${TYPE_CLS[t.type] || TYPE_CLS.success}`}
        >
          <p className="leading-snug">{t.message}</p>
          {t.actions?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 mt-3">
              {t.actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  className={BTN_CLS[a.variant] || BTN_CLS.secondary}
                  onClick={() => void a.onClick()}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <>
      {topCenter.length > 0 && renderStack(topCenter, 'fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[min(92vw,28rem)]')}
      {bottomRight.length > 0 && renderStack(bottomRight, 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm')}
    </>
  );
}
