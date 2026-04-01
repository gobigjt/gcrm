export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(10,12,24,0.55)' }}>
      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal
                      border border-slate-200/80 dark:border-slate-700/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500
                       hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700
                       transition-all text-lg leading-none">
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
