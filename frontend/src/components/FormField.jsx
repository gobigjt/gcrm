export function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
  'focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand-400 dark:focus:border-brand-500 ' +
  'focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/40 transition-all duration-150';

export const selectCls = inputCls;

export function FormActions({ onCancel, submitLabel = 'Save', loading = false }) {
  return (
    <div className="flex justify-end gap-2.5 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50">
      <button type="button" onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300
                   bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700
                   rounded-xl transition-all duration-150">
        Cancel
      </button>
      <button type="submit" disabled={loading}
        className="px-5 py-2 text-sm font-semibold text-white
                   bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700
                   disabled:opacity-60 rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98]">
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
