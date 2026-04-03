import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const fieldCls =
  'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl ' +
  'text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
  'focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand-400 dark:focus:border-brand-500 ' +
  'focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/40 transition-all duration-150';

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join('. ') : msg;
      setError(text || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] dark:bg-[#0d0f1a] flex items-center justify-center px-4 transition-colors duration-200"
         style={{ backgroundImage: dark
           ? 'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)'
           : 'radial-gradient(ellipse at 60% 0%, #e0e7ff 0%, transparent 60%)' }}>

      {/* Theme toggle (top-right) */}
      <button onClick={toggle} aria-label="Toggle theme"
        className="fixed top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl
                   bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                   text-slate-500 dark:text-slate-400 hover:border-brand-400 transition-all shadow-card text-base">
        {dark ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto shadow-lg mb-4">
            <span className="text-white text-xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">EzCRM</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-7">
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" required placeholder="you@company.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
              <input type="password" required placeholder="••••••••" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={fieldCls} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-wf-primary py-3 text-sm rounded-xl mt-2
                         disabled:opacity-60 shadow-sm transition-all duration-150 active:scale-[0.98]">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          No account?{' '}
          <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
