import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [passwordVisible, setPasswordVisible] = useState(false);

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
          <img
            src={dark ? '/logo-white.png' : '/logo-dark.png'}
            alt="EzCRM logo"
            className="h-14 w-auto max-w-[240px] mx-auto mb-4 rounded-md object-contain p-1"
          />
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
              <div className="relative">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={`${fieldCls} pr-11`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  onClick={() => setPasswordVisible(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 rounded-r-xl
                    text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2
                    dark:focus-visible:ring-offset-[#1a1d2e]"
                >
                  {passwordVisible ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 13 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-wf-primary py-3 text-sm rounded-xl mt-2
                         disabled:opacity-60 shadow-sm transition-all duration-150 active:scale-[0.98]">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
