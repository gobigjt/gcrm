import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';

const typeClass = {
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setRows(res.data?.notifications || res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearRead = async () => {
    await api.delete('/notifications/read');
    setRows((prev) => prev.filter((n) => !n.is_read));
  };

  const fmtDate = (v) => (v ? new Date(v).toLocaleString('en-IN') : '—');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Notifications</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Your feed with read/unread status</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Mark all read
          </button>
          <button
            onClick={clearRead}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Clear read
          </button>
          <button
            onClick={load}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <Table
        cols={['Status', 'Title', 'Details', 'Type', 'Module', 'Time', 'Action']}
        rows={rows.map((n) => [
          n.is_read ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">Read</span>
          ) : (
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Unread</span>
          ),
          <span className={n.is_read ? 'text-slate-500 dark:text-slate-400' : 'font-semibold'}>{n.title}</span>,
          n.body || '—',
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${typeClass[n.type] || typeClass.info}`}>
            {(n.type || 'info').toUpperCase()}
          </span>,
          n.module || '—',
          fmtDate(n.created_at),
          n.is_read ? (
            '—'
          ) : (
            <button
              onClick={() => markRead(n.id)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Mark read
            </button>
          ),
        ])}
        empty={loading ? 'Loading notifications...' : 'No notifications yet'}
      />
    </div>
  );
}
