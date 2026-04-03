export default function Table({ cols, rows, empty = 'No records found' }) {
  return (
    <div className="bg-white dark:bg-[#13152a] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f5f4ef] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50">
              {cols.map(c => (
                <th key={c} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.04em] whitespace-nowrap">
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
              <tr key={i} className="border-b border-slate-200/80 dark:border-slate-700/40 last:border-0 hover:bg-[#f5f4ef] dark:hover:bg-slate-800/30 transition-colors duration-100">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">{cell ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
