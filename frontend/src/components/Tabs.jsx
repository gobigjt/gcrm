export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl w-fit mb-6">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap
            ${active === t
              ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-card font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
