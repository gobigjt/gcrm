export default function Table({ cols, rows, empty = 'No records found' }) {
  return (
    <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/50">
              {cols.map(c => (
                <th key={c} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl opacity-30">◫</span>
                    <span>{empty}</span>
                  </div>
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors duration-100">
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{cell ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
