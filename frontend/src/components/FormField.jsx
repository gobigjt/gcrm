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
        className="btn-wf-secondary">
        Cancel
      </button>
      <button type="submit" disabled={loading}
        className="btn-wf-primary">
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
